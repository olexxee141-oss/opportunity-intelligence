import { healthDb } from './health.db.js';
export const healthService = {
  async getStatus() {
    await healthDb.checkDatabase();
    return { status: 'ok' as const, timestamp: new Date().toISOString(), dependencies: { database: 'ok' as const } };
  },
};
