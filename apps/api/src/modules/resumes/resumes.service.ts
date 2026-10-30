import { createHash, randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { createDownloadUrl, deleteObject, uploadObject } from '@oi/storage';
import { env } from '../../config/env.js';
import { resumesDb } from './resumes.db.js';
import type { ResumeUpload } from './resumes.types.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const processingQueue = new Queue('resume-processing', { connection: redis });

function httpError(statusCode: number, code: string, message: string) {
  return Object.assign(new Error(message), { statusCode, code });
}
async function isDocx(buffer: Buffer): Promise<boolean> {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) return false;
  try {
    const yauzl = await import('yauzl');
    return await new Promise((resolve) => {
      yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
        if (error || !zip) return resolve(false);
        let contentTypes = false;
        let documentXml = false;
        zip.on('entry', (entry) => {
          if (entry.fileName === '[Content_Types].xml') contentTypes = true;
          if (entry.fileName === 'word/document.xml') documentXml = true;
          zip.readEntry();
        });
        zip.on('end', () => resolve(contentTypes && documentXml));
        zip.on('error', () => resolve(false));
        zip.readEntry();
      });
    });
  } catch { return false; }
}
async function validateFile(file: ResumeUpload): Promise<void> {
  if (file.size > MAX_FILE_SIZE) throw httpError(413, 'FILE_TOO_LARGE', 'Resume must be 10 MB or smaller');
  if (file.mimeType === PDF_MIME) {
    if (file.buffer.subarray(0, 5).toString() !== '%PDF-') throw httpError(400, 'INVALID_FILE', 'The uploaded file is not a valid PDF');
    return;
  }
  if (file.mimeType === DOCX_MIME && await isDocx(file.buffer)) return;
  throw httpError(400, 'UNSUPPORTED_FILE', 'Only valid PDF and DOCX resumes are accepted');
}
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'resume';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'resume';
}
export const resumesService = {
  list(workspaceId: string, userId: string) { return resumesDb.list(workspaceId, userId); },
  async upload(workspaceId: string, userId: string, file: ResumeUpload) {
    await validateFile(file);
    const checksumSha256 = createHash('sha256').update(file.buffer).digest('hex');
    if (await resumesDb.findDuplicate(workspaceId, checksumSha256)) throw httpError(409, 'DUPLICATE_RESUME', 'This file has already been uploaded to this workspace');
    const profile = await resumesDb.ensureProfile(workspaceId, userId);
    const id = randomUUID();
    const fileName = safeFileName(file.originalName);
    const storageKey = 'workspaces/' + workspaceId + '/career-profiles/' + profile.id + '/resumes/' + id + '/' + fileName;
    await uploadObject(storageKey, file.buffer, file.mimeType);
    let resume;
    try {
      resume = await resumesDb.create({
        workspaceId, careerProfileId: profile.id, uploadedByUserId: userId,
        fileName, mimeType: file.mimeType, fileSizeBytes: file.size, storageKey, checksumSha256,
      });
      await processingQueue.add('parse-resume', { resumeId: resume.id, storageKey, mimeType: file.mimeType }, {
        jobId: 'resume-' + resume.id, attempts: 3, backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000, removeOnFail: 2000,
      });
      return { id: resume.id, fileName: resume.fileName, mimeType: resume.mimeType, fileSizeBytes: resume.fileSizeBytes, status: resume.status, createdAt: resume.createdAt };
    } catch (error) {
      if (resume) await resumesDb.deleteOwned(workspaceId, userId, resume.id).catch(() => undefined);
      await deleteObject(storageKey).catch(() => undefined);
      throw error;
    }
  },
  async getDownloadUrl(workspaceId: string, userId: string, id: string) {
    const resume = await resumesDb.findOwned(workspaceId, userId, id);
    if (!resume) throw httpError(404, 'RESUME_NOT_FOUND', 'Resume was not found');
    return { url: await createDownloadUrl(resume.storageKey), expiresInSeconds: 300 };
  },
  async remove(workspaceId: string, userId: string, id: string) {
    const resume = await resumesDb.findOwned(workspaceId, userId, id);
    if (!resume) throw httpError(404, 'RESUME_NOT_FOUND', 'Resume was not found');
    await deleteObject(resume.storageKey);
    await resumesDb.deleteOwned(workspaceId, userId, id);
  },
};
