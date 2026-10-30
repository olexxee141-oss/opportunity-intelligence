import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from '@oi/database';
import { safeGet } from './safe-http.js';
import { setTimeout as delay } from 'node:timers/promises';

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
const discoveryQueue = new Queue('source-discovery', { connection });
type DiscoveryJob = { runId: string; sourceId: string; workspaceId: string };

function canonicalize(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    }
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch { return null; }
}

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc[^>]*>([\s\S]*?)<\/loc>/gi)].map((match) =>
    (match[1] ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim(),
  ).filter(Boolean);
}

function extractFeedLinks(xml: string, atom: boolean): string[] {
  if (atom) return [...xml.matchAll(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/gi)].map((m) => m[1]!).filter(Boolean);
  return [...xml.matchAll(/<link[^>]*>([\s\S]*?)<\/link>/gi)].map((m) => (m[1] ?? '').trim()).filter(Boolean);
}

function extractHtmlLinks(html: string, baseUrl: string): { feeds: string[]; links: string[] } {
  const feeds: string[] = [];
  const links: string[] = [];
  for (const match of html.matchAll(/<link\b([^>]*)>/gi)) {
    const attrs = match[1] ?? '';
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (href && type && /(rss|atom|xml)/.test(type)) feeds.push(new URL(href, baseUrl).toString());
  }
  for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
    const href = match[1]?.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href || /^(#|mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    try { links.push(new URL(href, baseUrl).toString()); } catch { /* Ignore malformed links. */ }
  }
  return { feeds, links };
}

function isAllowedByRobots(url: string, disallowed: string[]): boolean {
  const path = new URL(url).pathname;
  return !disallowed.some((rule) => rule !== '/' && path.startsWith(rule)) && !disallowed.includes('/');
}

async function discover(job: Job<DiscoveryJob>) {
  const { runId, sourceId, workspaceId } = job.data;
  const source = await prisma.source.findFirst({ where: { id: sourceId, workspaceId } });
  const run = await prisma.sourceDiscoveryRun.findFirst({ where: { id: runId, sourceId, workspaceId } });
  if (!source || !run) throw new Error('Discovery source or run was not found');
  if (source.status !== 'ACTIVE') {
    await prisma.sourceDiscoveryRun.update({ where: { id: runId }, data: { status: 'FAILED', error: 'Source is not active', completedAt: new Date() } });
    await prisma.source.update({ where: { id: sourceId }, data: { discoveryLeaseExpiresAt: null } });
    return;
  }
  await prisma.sourceDiscoveryRun.update({ where: { id: runId }, data: { status: 'RUNNING', startedAt: new Date(), error: null } });

  try {
    let nextAllowedRequestAt = 0;
    const fetchSourceUrl = async (url: string) => {
      const waitMs = Math.max(0, nextAllowedRequestAt - Date.now());
      if (waitMs > 0) await delay(waitMs);
      nextAllowedRequestAt = Date.now() + Math.ceil(60_000 / source.requestsPerMinute);
      await prisma.source.update({
        where: { id: sourceId },
        data: { discoveryLeaseExpiresAt: new Date(Date.now() + 10 * 60_000) },
      });
      return safeGet(url);
    };
    const base = new URL(source.baseUrl);
    const robotsUrl = new URL('/robots.txt', base.origin).toString();
    const robotsResponse = await fetchSourceUrl(robotsUrl);
    if (robotsResponse.statusCode !== 200 && robotsResponse.statusCode !== 404 && robotsResponse.statusCode !== 410) {
      throw new Error('Unable to verify robots.txt policy; discovery is stopped');
    }
    const robotsLines = robotsResponse.statusCode === 200 ? robotsResponse.body.split(/\r?\n/) : [];
    const disallowed: string[] = [];
    const sitemapHints: string[] = [];
    let applies = false;
    for (const raw of robotsLines) {
      const line = raw.split('#')[0]?.trim() ?? '';
      const separator = line.indexOf(':');
      if (separator < 0) continue;
      const key = line.slice(0, separator).trim().toLowerCase();
      const value = line.slice(separator + 1).trim();
      if (key === 'user-agent') applies = value === '*' || /opportunityintelligencebot/i.test(value);
      if (applies && key === 'disallow' && value) disallowed.push(value);
      if (key === 'sitemap' && value) sitemapHints.push(value);
    }
    const robots = disallowed;
    const sitemaps = sitemapHints;
    const isAllowed = (url: string) => isAllowedByRobots(url, robots);
    const sitemapUrls = [...new Set([...sitemaps, new URL('/sitemap.xml', base.origin).toString()])].slice(0, 10);
    const found: Array<{ url: string; from: string; method: 'SITEMAP' | 'RSS' | 'ATOM' | 'HTML_LINK' }> = [];
    for (const sitemapUrl of sitemapUrls) {
      if (!isAllowedByRobots(sitemapUrl, robots)) continue;
      const response = await fetchSourceUrl(sitemapUrl);
      if (response.statusCode !== 200) continue;
      const locations = extractLocs(response.body);
      if (/<sitemapindex\b/i.test(response.body)) {
        for (const nested of locations.slice(0, 10)) {
          if (!isAllowed(nested)) continue;
          const nestedResponse = await fetchSourceUrl(nested);
          if (nestedResponse.statusCode === 200) {
            for (const url of extractLocs(nestedResponse.body)) found.push({ url, from: nested, method: 'SITEMAP' });
          }
        }
      } else {
        for (const url of locations) found.push({ url, from: sitemapUrl, method: 'SITEMAP' });
      }
    }

    const rootResponse = isAllowed(source.baseUrl) ? await fetchSourceUrl(source.baseUrl) : { statusCode: 0, body: '' };
    if (rootResponse.statusCode === 200) {
      const { feeds, links } = extractHtmlLinks(rootResponse.body, source.baseUrl);
      for (const link of links) found.push({ url: link, from: source.baseUrl, method: 'HTML_LINK' });
      for (const feedUrl of feeds.slice(0, 10)) {
        if (!isAllowed(feedUrl)) continue;\n        const feedResponse = await fetchSourceUrl(feedUrl);
        if (feedResponse.statusCode !== 200) continue;
        const atom = /<feed\b/i.test(feedResponse.body);
        for (const url of extractFeedLinks(feedResponse.body, atom)) {
          found.push({ url, from: feedUrl, method: atom ? 'ATOM' : 'RSS' });
        }
      }
    }

    const unique = new Map<string, { url: string; canonicalUrl: string; from: string; method: 'SITEMAP' | 'RSS' | 'ATOM' | 'HTML_LINK' }>();
    for (const item of found) {
      const canonicalUrl = canonicalize(item.url);
      if (!canonicalUrl || canonicalUrl.length > 2048 || !isAllowed(item.url)) continue;
      if (unique.has(canonicalUrl)) continue;
      unique.set(canonicalUrl, { ...item, canonicalUrl });
      if (unique.size >= source.maxPagesPerRun) break;
    }

    let newCount = 0;
    for (const candidate of unique.values()) {
      const existing = await prisma.discoveryCandidate.findUnique({
        where: { sourceId_canonicalUrl: { sourceId, canonicalUrl: candidate.canonicalUrl } },
        select: { id: true },
      });
      await prisma.discoveryCandidate.upsert({
        where: { sourceId_canonicalUrl: { sourceId, canonicalUrl: candidate.canonicalUrl } },
        create: {
          workspaceId, sourceId, url: candidate.url, canonicalUrl: candidate.canonicalUrl,
          discoveredFromUrl: candidate.from, method: candidate.method,
        },
        update: { url: candidate.url, discoveredFromUrl: candidate.from, method: candidate.method, lastSeenAt: new Date() },
      });
      if (!existing) newCount += 1;
    }

    await prisma.sourceDiscoveryRun.update({
      where: { id: runId },
      data: { status: 'COMPLETED', completedAt: new Date(), discoveredCount: unique.size, newCount, rejectedCount: found.length - unique.size },
    });
    await prisma.source.update({
      where: { id: sourceId },
      data: { lastDiscoveryAt: new Date(), nextDiscoveryAt: new Date(Date.now() + source.crawlIntervalMinutes * 60_000), discoveryLeaseExpiresAt: null },
    });
    return { discoveredCount: unique.size, newCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Source discovery failed';
    const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    if (finalAttempt) {
      await prisma.sourceDiscoveryRun.update({
        where: { id: runId }, data: { status: 'FAILED', error: message.slice(0, 2000), completedAt: new Date() },
      }).catch(() => undefined);
      await prisma.source.update({
        where: { id: sourceId },
        data: { nextDiscoveryAt: new Date(Date.now() + Math.max(30, source.crawlIntervalMinutes) * 60_000), discoveryLeaseExpiresAt: null },
      }).catch(() => undefined);
    } else {
      await prisma.source.update({
        where: { id: sourceId },
        data: { discoveryLeaseExpiresAt: new Date(Date.now() + 10 * 60_000) },
      }).catch(() => undefined);
    }
    throw error;
  }
}

async function scheduleDueSources() {
  const now = new Date();
  const due = await prisma.source.findMany({
    where: {
      status: 'ACTIVE', channel: { in: ['WEBSITE', 'FEED'] }, nextDiscoveryAt: { lte: now },
      OR: [{ discoveryLeaseExpiresAt: null }, { discoveryLeaseExpiresAt: { lt: now } }],
    },
    select: { id: true, workspaceId: true, crawlIntervalMinutes: true },
    take: 50,
    orderBy: { nextDiscoveryAt: 'asc' },
  });
  for (const source of due) {
    const lease = await prisma.source.updateMany({
      where: {
        id: source.id, status: 'ACTIVE', channel: { in: ['WEBSITE', 'FEED'] }, nextDiscoveryAt: { lte: now },
        OR: [{ discoveryLeaseExpiresAt: null }, { discoveryLeaseExpiresAt: { lt: now } }],
      },
      data: { discoveryLeaseExpiresAt: new Date(Date.now() + 10 * 60_000), nextDiscoveryAt: new Date(Date.now() + source.crawlIntervalMinutes * 60_000) },
    });
    if (lease.count === 0) continue;
    const run = await prisma.sourceDiscoveryRun.create({
      data: { workspaceId: source.workspaceId, sourceId: source.id, trigger: 'SCHEDULED' },
    });
    try {
      await discoveryQueue.add('discover-source', { runId: run.id, sourceId: source.id, workspaceId: source.workspaceId }, {
        jobId: run.id, attempts: 3, backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000, removeOnFail: 2000,
      });
    } catch (error) {
      await prisma.sourceDiscoveryRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: 'Unable to enqueue scheduled discovery', completedAt: new Date() } });
      await prisma.source.update({ where: { id: source.id }, data: { discoveryLeaseExpiresAt: null } });
      throw error;
    }
  }
}

export const sourceDiscoveryWorker = new Worker('source-discovery', async (job: Job) => {
  if (job.name === 'discover-source') return discover(job as Job<DiscoveryJob>);
  if (job.name === 'schedule-due-sources') return scheduleDueSources();
  throw new Error('Unsupported source discovery job: ' + job.name);
}, { connection, concurrency: 3 });

export async function startSourceDiscoveryScheduler() {
  await discoveryQueue.add('schedule-due-sources', {}, {
    jobId: 'source-discovery-scheduler',
    repeat: { every: 60_000 },
    removeOnComplete: true,
  });
}

export async function closeSourceDiscoveryProcessor() {
  await sourceDiscoveryWorker.close();
  await discoveryQueue.close();
  await connection.quit();
}
