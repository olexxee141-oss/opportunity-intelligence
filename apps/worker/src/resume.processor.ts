import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from '@oi/database';
import { downloadObject } from '@oi/storage';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
type ResumeJob = { resumeId: string; storageKey: string; mimeType: string };

async function processResume(job: Job<ResumeJob>) {
  const { resumeId, storageKey, mimeType } = job.data;
  await prisma.resume.update({ where: { id: resumeId }, data: { status: 'PROCESSING', parseError: null } });
  try {
    const buffer = await downloadObject(storageKey);
    let extractedText = '';
    if (mimeType === 'application/pdf') {
      const parsed = await pdf(buffer);
      extractedText = parsed.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const parsed = await mammoth.extractRawText({ buffer });
      extractedText = parsed.value;
    } else throw new Error('Unsupported resume format');
    const normalizedText = extractedText.replace(/\u0000/g, '').trim();
    if (!normalizedText) throw new Error('No readable text could be extracted from this resume');
    await prisma.resume.update({
      where: { id: resumeId },
      data: { status: 'READY', extractedText: normalizedText, parseError: null, parsedAt: new Date() },
    });
    return { characterCount: normalizedText.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resume parsing failed';
    await prisma.resume.update({
      where: { id: resumeId }, data: { status: 'FAILED', parseError: message.slice(0, 1000) },
    }).catch(() => undefined);
    throw error;
  }
}
export const resumeProcessor = new Worker<ResumeJob>('resume-processing', processResume, { connection });
resumeProcessor.on('failed', (job, error) => console.error('Resume processing failed', { jobId: job?.id, error: error.message }));
export async function closeResumeProcessor() {
  await resumeProcessor.close();
  await connection.quit();
}
