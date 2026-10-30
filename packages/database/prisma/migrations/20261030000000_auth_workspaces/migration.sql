CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

ALTER TABLE "User"
ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE "RefreshSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");
CREATE INDEX "RefreshSession_userId_revokedAt_idx" ON "RefreshSession"("userId", "revokedAt");
CREATE INDEX "RefreshSession_expiresAt_idx" ON "RefreshSession"("expiresAt");
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
