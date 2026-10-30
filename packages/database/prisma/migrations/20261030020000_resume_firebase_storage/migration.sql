CREATE UNIQUE INDEX "CareerPreference_workspaceId_careerProfileId_key" ON "CareerPreference"("workspaceId", "careerProfileId");
ALTER TABLE "Resume" ALTER COLUMN "storageProvider" SET DEFAULT 'firebase';
