CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP', 'FREELANCE');
CREATE TYPE "WorkMode" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE');
CREATE TYPE "SalaryPeriod" AS ENUM ('HOURLY', 'MONTHLY', 'ANNUAL');
CREATE TYPE "SkillProficiency" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');
CREATE TYPE "ResumeStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'FAILED');

CREATE TABLE "CareerProfile" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "headline" TEXT,
  "professionalSummary" TEXT,
  "currentLocation" TEXT,
  "yearsOfExperience" INTEGER,
  "linkedinUrl" TEXT,
  "portfolioUrl" TEXT,
  "websiteUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareerExperience" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "careerProfileId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "location" TEXT,
  "employmentType" "EmploymentType",
  "startDate" DATE,
  "endDate" DATE,
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT,
  "achievements" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareerExperience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareerEducation" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "careerProfileId" UUID NOT NULL,
  "institution" TEXT NOT NULL,
  "qualification" TEXT,
  "fieldOfStudy" TEXT,
  "location" TEXT,
  "startDate" DATE,
  "endDate" DATE,
  "grade" TEXT,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareerEducation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareerCertification" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "careerProfileId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "issuer" TEXT,
  "credentialId" TEXT,
  "credentialUrl" TEXT,
  "issuedAt" DATE,
  "expiresAt" DATE,
  "doesNotExpire" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareerCertification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Skill" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareerProfileSkill" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "careerProfileId" UUID NOT NULL,
  "skillId" UUID NOT NULL,
  "proficiency" "SkillProficiency",
  "yearsExperience" DECIMAL(4,1),
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareerProfileSkill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareerPreference" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "careerProfileId" UUID NOT NULL,
  "desiredJobTitles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "preferredLocations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "industries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "employmentTypes" "EmploymentType"[] NOT NULL DEFAULT ARRAY[]::"EmploymentType"[],
  "workModes" "WorkMode"[] NOT NULL DEFAULT ARRAY[]::"WorkMode"[],
  "minSalaryAmount" DECIMAL(12,2),
  "maxSalaryAmount" DECIMAL(12,2),
  "salaryCurrency" TEXT,
  "salaryPeriod" "SalaryPeriod",
  "willingToRelocate" BOOLEAN NOT NULL DEFAULT false,
  "requiresSponsorship" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareerPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Resume" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "careerProfileId" UUID NOT NULL,
  "uploadedByUserId" UUID NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL,
  "storageProvider" TEXT NOT NULL DEFAULT 'local',
  "storageKey" TEXT NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "status" "ResumeStatus" NOT NULL DEFAULT 'UPLOADED',
  "extractedText" TEXT,
  "parseError" TEXT,
  "parsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CareerProfile_workspaceId_userId_key" ON "CareerProfile"("workspaceId", "userId");
CREATE UNIQUE INDEX "CareerProfile_workspaceId_id_key" ON "CareerProfile"("workspaceId", "id");
CREATE INDEX "CareerProfile_userId_idx" ON "CareerProfile"("userId");
CREATE INDEX "CareerExperience_workspaceId_careerProfileId_sortOrder_idx" ON "CareerExperience"("workspaceId", "careerProfileId", "sortOrder");
CREATE INDEX "CareerEducation_workspaceId_careerProfileId_sortOrder_idx" ON "CareerEducation"("workspaceId", "careerProfileId", "sortOrder");
CREATE INDEX "CareerCertification_workspaceId_careerProfileId_idx" ON "CareerCertification"("workspaceId", "careerProfileId");
CREATE UNIQUE INDEX "Skill_normalizedName_key" ON "Skill"("normalizedName");
CREATE UNIQUE INDEX "CareerProfileSkill_careerProfileId_skillId_key" ON "CareerProfileSkill"("careerProfileId", "skillId");
CREATE INDEX "CareerProfileSkill_workspaceId_careerProfileId_idx" ON "CareerProfileSkill"("workspaceId", "careerProfileId");
CREATE INDEX "CareerProfileSkill_skillId_idx" ON "CareerProfileSkill"("skillId");
CREATE UNIQUE INDEX "CareerPreference_careerProfileId_key" ON "CareerPreference"("careerProfileId");
CREATE INDEX "CareerPreference_workspaceId_idx" ON "CareerPreference"("workspaceId");
CREATE UNIQUE INDEX "Resume_storageKey_key" ON "Resume"("storageKey");
CREATE UNIQUE INDEX "Resume_workspaceId_checksumSha256_key" ON "Resume"("workspaceId", "checksumSha256");
CREATE INDEX "Resume_workspaceId_careerProfileId_createdAt_idx" ON "Resume"("workspaceId", "careerProfileId", "createdAt");
CREATE INDEX "Resume_uploadedByUserId_idx" ON "Resume"("uploadedByUserId");
CREATE INDEX "Resume_status_createdAt_idx" ON "Resume"("status", "createdAt");

ALTER TABLE "CareerProfile" ADD CONSTRAINT "CareerProfile_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerProfile" ADD CONSTRAINT "CareerProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerExperience" ADD CONSTRAINT "CareerExperience_workspaceId_careerProfileId_fkey"
FOREIGN KEY ("workspaceId", "careerProfileId") REFERENCES "CareerProfile"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerEducation" ADD CONSTRAINT "CareerEducation_workspaceId_careerProfileId_fkey"
FOREIGN KEY ("workspaceId", "careerProfileId") REFERENCES "CareerProfile"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerCertification" ADD CONSTRAINT "CareerCertification_workspaceId_careerProfileId_fkey"
FOREIGN KEY ("workspaceId", "careerProfileId") REFERENCES "CareerProfile"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerProfileSkill" ADD CONSTRAINT "CareerProfileSkill_workspaceId_careerProfileId_fkey"
FOREIGN KEY ("workspaceId", "careerProfileId") REFERENCES "CareerProfile"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerProfileSkill" ADD CONSTRAINT "CareerProfileSkill_skillId_fkey"
FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CareerPreference" ADD CONSTRAINT "CareerPreference_workspaceId_careerProfileId_fkey"
FOREIGN KEY ("workspaceId", "careerProfileId") REFERENCES "CareerProfile"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_workspaceId_careerProfileId_fkey"
FOREIGN KEY ("workspaceId", "careerProfileId") REFERENCES "CareerProfile"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
