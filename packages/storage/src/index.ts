import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

function getBucket() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw Object.assign(new Error('Firebase Storage is not configured'), { statusCode: 503, code: 'STORAGE_NOT_CONFIGURED' });
  let app = getApps()[0];
  if (!app) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (projectId && clientEmail && privateKey) app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), storageBucket: bucketName });
    else app = initializeApp({ storageBucket: bucketName });
  }
  return getStorage(app).bucket(bucketName);
}
export async function uploadObject(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await getBucket().file(key).save(buffer, { resumable: false, validation: 'crc32c', metadata: { contentType, cacheControl: 'private, no-store' } });
}
export async function downloadObject(key: string): Promise<Buffer> {
  const file = getBucket().file(key);
  const [exists] = await file.exists();
  if (!exists) throw Object.assign(new Error('Stored file was not found'), { statusCode: 404, code: 'STORAGE_OBJECT_NOT_FOUND' });
  const [contents] = await file.download();
  return contents;
}
export async function createDownloadUrl(key: string): Promise<string> {
  const [url] = await getBucket().file(key).getSignedUrl({ action: 'read', expires: Date.now() + 5 * 60 * 1000, version: 'v4' });
  return url;
}
export async function deleteObject(key: string): Promise<void> {
  await getBucket().file(key).delete({ ignoreNotFound: true });
}
