import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

type SafeResponse = { statusCode: number; headers: Record<string, string | string[] | undefined>; body: string; url: string };

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const parts = address.split('.').map(Number);
    const [a, b, c] = parts;
    if (a === undefined || b === undefined || c === undefined) return false;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 0 || b === 168)) return false;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    if (a === 192 && b === 0 && c === 2) return false;
    return true;
  }
  if (family === 6) {
    const value = address.toLowerCase();
    return (value.startsWith('2') || value.startsWith('3')) && !value.startsWith('2001:db8:');
  }
  return false;
}

async function resolvePublicHost(inputHostname: string): Promise<{ address: string; family: number }> {
  const hostname = inputHostname.replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Private hostnames are not crawlable');
  }
  if (isIP(hostname)) {
    if (!isPublicAddress(hostname)) throw new Error('Private or reserved IP addresses are not crawlable');
    return { address: hostname, family: isIP(hostname) };
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => !isPublicAddress(record.address))) {
    throw new Error('Hostname resolves to a private or reserved network address');
  }
  return records[0]!;
}

function requestOnce(url: URL, resolved: { address: string; family: number }, timeoutMs: number, maxBytes: number): Promise<SafeResponse> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const request = transport({
      protocol: url.protocol,
      hostname,
      port: url.port || undefined,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'user-agent': 'OpportunityIntelligenceBot/1.0 (+source discovery)', accept: 'text/html,application/xml,application/rss+xml,application/atom+xml;q=0.9,*/*;q=0.1' },
      lookup: (_hostname, _options, callback) => callback(null, resolved.address, resolved.family),
      servername: hostname,
      timeout: timeoutMs,
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          request.destroy(new Error('Response exceeded the discovery size limit'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({
        statusCode: response.statusCode ?? 0,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
        url: url.toString(),
      }));
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('Source request timed out')));
    request.on('error', reject);
    request.end();
  });
}

export async function safeGet(input: string): Promise<SafeResponse> {
  let current = new URL(input);
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    if (!['http:', 'https:'].includes(current.protocol) || current.username || current.password) {
      throw new Error('Only credential-free HTTP(S) URLs are supported');
    }
    const resolved = await resolvePublicHost(current.hostname);
    const response = await requestOnce(current, resolved, 12000, 2 * 1024 * 1024);
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = response.headers.location;
      if (typeof location !== 'string') throw new Error('Redirect response did not include a location');
      if (redirects === 4) throw new Error('Too many redirects');
      current = new URL(location, current);
      continue;
    }
    return response;
  }
  throw new Error('Too many redirects');
}
