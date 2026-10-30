CREATE TYPE "OpportunitySourceType" AS ENUM ('JOB_BOARD', 'COMPANY_CAREERS', 'AGGREGATOR', 'GOVERNMENT', 'OTHER');
CREATE TYPE "SourceOpportunityType" AS ENUM ('JOB', 'INTERNSHIP', 'SCHOLARSHIP', 'GRANT', 'FREELANCE', 'OTHER');
CREATE TYPE "SourceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "SourceCrawlMethod" AS ENUM ('AUTO', 'HTTP', 'BROWSER');

CREATE TABLE "Source" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "baseUrl" VARCHAR(2048) NOT NULL,
  "canonicalUrl" VARCHAR(2048) NOT NULL,
  "sourceType" "OpportunitySourceType" NOT NULL,
  "opportunityType" "SourceOpportunityType" NOT NULL DEFAULT 'JOB',
  "status" "SourceStatus" NOT NULL DEFAULT 'ACTIVE',
  "crawlMethod" "SourceCrawlMethod" NOT NULL DEFAULT 'AUTO',
  "crawlIntervalMinutes" INTEGER NOT NULL DEFAULT 360,
  "maxPagesPerRun" INTEGER NOT NULL DEFAULT 20,
  "requestsPerMinute" INTEGER NOT NULL DEFAULT 6,
  "notes" TEXT,
  "lastCrawledAt" TIMESTAMP(3),
  "lastCrawlStatus" TEXT,
  "lastCrawlError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Source_workspaceId_canonicalUrl_key" ON "Source"("workspaceId", "canonicalUrl");
CREATE INDEX "Source_workspaceId_status_updatedAt_idx" ON "Source"("workspaceId", "status", "updatedAt");
CREATE INDEX "Source_status_updatedAt_idx" ON "Source"("status", "updatedAt");

ALTER TABLE "Source" ADD CONSTRAINT "Source_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
