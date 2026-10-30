import { prisma } from '@oi/database';
export const healthDb = {
  async checkDatabase(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  },
};
