CREATE TYPE "ResumeAnalysisStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ResumeProposalType" AS ENUM ('PROFILE_FIELD', 'EXPERIENCE', 'EDUCATION', 'CERTIFICATION', 'SKILL');
CREATE TYPE "ResumeProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE "ResumeAnalysis" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "careerProfileId" UUID NOT NULL,
  "resumeId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "status" "ResumeAnalysisStatus" NOT NULL DEFAULT 'QUEUED',
  "summary" TEXT,
  "extraction" JSONB,
  "missingInformation" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "weakAreas" JSONB,
  "error" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResumeAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResumeProfileProposal" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "analysisId" UUID NOT NULL,
  "type" "ResumeProposalType" NOT NULL,
  "payload" JSONB NOT NULL,
  "evidence" TEXT NOT NULL,
  "confidence" DECIMAL(3,2) NOT NULL,
  "status" "ResumeProposalStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResumeProfileProposal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResumeAnalysis_workspaceId_id_key" ON "ResumeAnalysis"("workspaceId", "id");
CREATE INDEX "ResumeAnalysis_workspaceId_resumeId_createdAt_idx" ON "ResumeAnalysis"("workspaceId", "resumeId", "createdAt");
CREATE INDEX "ResumeAnalysis_status_createdAt_idx" ON "ResumeAnalysis"("status", "createdAt");
CREATE INDEX "ResumeProfileProposal_workspaceId_analysisId_status_idx" ON "ResumeProfileProposal"("workspaceId", "analysisId", "status");

ALTER TABLE "ResumeAnalysis" ADD CONSTRAINT "ResumeAnalysis_workspaceId_careerProfileId_fkey"
FOREIGN KEY ("workspaceId", "careerProfileId") REFERENCES "CareerProfile"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResumeAnalysis" ADD CONSTRAINT "ResumeAnalysis_resumeId_fkey"
FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResumeProfileProposal" ADD CONSTRAINT "ResumeProfileProposal_workspaceId_analysisId_fkey"
FOREIGN KEY ("workspaceId", "analysisId") REFERENCES "ResumeAnalysis"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
