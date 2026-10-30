-- Replace the single-valued enum with extensible category keys.
ALTER TABLE "Source" ADD COLUMN "supportedOpportunityTypes" TEXT[] NOT NULL DEFAULT ARRAY['JOB']::TEXT[];
UPDATE "Source" SET "supportedOpportunityTypes" = ARRAY["opportunityType"::TEXT];
ALTER TABLE "Source" DROP COLUMN "opportunityType";
DROP TYPE "SourceOpportunityType";

CREATE TYPE "SourceChannel" AS ENUM ('WEBSITE', 'FEED', 'API', 'SOCIAL', 'SUBMISSION');
ALTER TABLE "Source" ADD COLUMN "channel" "SourceChannel" NOT NULL DEFAULT 'WEBSITE', ADD COLUMN "providerKey" TEXT;

CREATE TYPE "DiscoveryRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');
CREATE TYPE "DiscoveryTrigger" AS ENUM ('MANUAL', 'SCHEDULED');
CREATE TYPE "DiscoveryMethod" AS ENUM ('SITEMAP', 'RSS', 'ATOM', 'HTML_LINK', 'MANUAL');
CREATE TYPE "DiscoveryCandidateStatus" AS ENUM ('DISCOVERED', 'QUEUED', 'REJECTED');

ALTER TABLE "Source"
  ADD COLUMN "nextDiscoveryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "discoveryLeaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "lastDiscoveryAt" TIMESTAMP(3);

CREATE INDEX "Source_status_nextDiscoveryAt_discoveryLeaseExpiresAt_idx"
  ON "Source"("status", "nextDiscoveryAt", "discoveryLeaseExpiresAt");

CREATE TABLE "SourceDiscoveryRun" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "sourceId" UUID NOT NULL,
  "status" "DiscoveryRunStatus" NOT NULL DEFAULT 'QUEUED',
  "trigger" "DiscoveryTrigger" NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "discoveredCount" INTEGER NOT NULL DEFAULT 0,
  "newCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedCount" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SourceDiscoveryRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SourceDiscoveryRun_workspaceId_createdAt_idx" ON "SourceDiscoveryRun"("workspaceId", "createdAt");
CREATE INDEX "SourceDiscoveryRun_sourceId_status_createdAt_idx" ON "SourceDiscoveryRun"("sourceId", "status", "createdAt");
ALTER TABLE "SourceDiscoveryRun" ADD CONSTRAINT "SourceDiscoveryRun_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceDiscoveryRun" ADD CONSTRAINT "SourceDiscoveryRun_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DiscoveryCandidate" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "sourceId" UUID NOT NULL,
  "url" VARCHAR(2048) NOT NULL,
  "canonicalUrl" VARCHAR(2048) NOT NULL,
  "discoveredFromUrl" VARCHAR(2048) NOT NULL,
  "method" "DiscoveryMethod" NOT NULL,
  "status" "DiscoveryCandidateStatus" NOT NULL DEFAULT 'DISCOVERED',
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscoveryCandidate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscoveryCandidate_sourceId_canonicalUrl_key" ON "DiscoveryCandidate"("sourceId", "canonicalUrl");
CREATE INDEX "DiscoveryCandidate_workspaceId_status_lastSeenAt_idx" ON "DiscoveryCandidate"("workspaceId", "status", "lastSeenAt");
CREATE INDEX "DiscoveryCandidate_sourceId_lastSeenAt_idx" ON "DiscoveryCandidate"("sourceId", "lastSeenAt");
ALTER TABLE "DiscoveryCandidate" ADD CONSTRAINT "DiscoveryCandidate_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryCandidate" ADD CONSTRAINT "DiscoveryCandidate_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
