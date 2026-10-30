import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { Prisma } from '@prisma/client';
import { prisma } from '@oi/database';
import { extractResumeProfile } from '@oi/ai';

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
type AnalysisJob = { analysisId: string };

function isGroundedEvidence(source: string, evidence: string): boolean {
  const quote = evidence.trim();
  return quote.length >= 8 && source.toLocaleLowerCase().includes(quote.toLocaleLowerCase());
}

async function processAnalysis(job: Job<AnalysisJob>) {
  const analysis = await prisma.resumeAnalysis.findUnique({
    where: { id: job.data.analysisId },
    include: { resume: { select: { extractedText: true } } },
  });
  if (!analysis) throw new Error('Resume analysis record was not found');
  const sourceText = analysis.resume.extractedText;
  if (!sourceText) throw new Error('Resume has no extracted text to analyze');

  await prisma.resumeAnalysis.update({ where: { id: analysis.id }, data: { status: 'PROCESSING', error: null } });
  try {
    const { provider, model, extraction } = await extractResumeProfile(sourceText);
    const proposals: Array<{
      workspaceId: string;
      type: 'PROFILE_FIELD' | 'EXPERIENCE' | 'EDUCATION' | 'CERTIFICATION' | 'SKILL';
      payload: Prisma.InputJsonValue;
      evidence: string;
      confidence: number;
    }> = [];

    for (const [field, fact] of Object.entries(extraction.profile)) {
      if (fact.value !== null && fact.evidence && isGroundedEvidence(sourceText, fact.evidence)) {
        proposals.push({
          workspaceId: analysis.workspaceId, type: 'PROFILE_FIELD',
          payload: { field, value: fact.value } as Prisma.InputJsonValue,
          evidence: fact.evidence, confidence: fact.confidence,
        });
      }
    }
    for (const item of extraction.experiences) {
      const { evidence, confidence, ...payload } = item;
      if (isGroundedEvidence(sourceText, evidence)) proposals.push({
        workspaceId: analysis.workspaceId, type: 'EXPERIENCE', payload: payload as Prisma.InputJsonValue, evidence, confidence,
      });
    }
    for (const item of extraction.educations) {
      const { evidence, confidence, ...payload } = item;
      if (isGroundedEvidence(sourceText, evidence)) proposals.push({
        workspaceId: analysis.workspaceId, type: 'EDUCATION', payload: payload as Prisma.InputJsonValue, evidence, confidence,
      });
    }
    for (const item of extraction.certifications) {
      const { evidence, confidence, ...payload } = item;
      if (isGroundedEvidence(sourceText, evidence)) proposals.push({
        workspaceId: analysis.workspaceId, type: 'CERTIFICATION', payload: payload as Prisma.InputJsonValue, evidence, confidence,
      });
    }
    for (const item of extraction.skills) {
      const { evidence, confidence, ...payload } = item;
      if (isGroundedEvidence(sourceText, evidence)) proposals.push({
        workspaceId: analysis.workspaceId, type: 'SKILL', payload: payload as Prisma.InputJsonValue, evidence, confidence,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.resumeProfileProposal.deleteMany({ where: { workspaceId: analysis.workspaceId, analysisId: analysis.id } });
      if (proposals.length) {
        await tx.resumeProfileProposal.createMany({
          data: proposals.map((proposal) => ({
            workspaceId: proposal.workspaceId, analysisId: analysis.id, type: proposal.type,
            payload: proposal.payload, evidence: proposal.evidence, confidence: proposal.confidence,
          })),
        });
      }
      await tx.resumeAnalysis.update({
        where: { id: analysis.id },
        data: {
          provider, model, status: 'COMPLETED',
          summary: extraction.profile.professionalSummary.value,
          extraction: extraction as unknown as Prisma.InputJsonValue,
          missingInformation: extraction.missingInformation,
          weakAreas: extraction.weakAreas as unknown as Prisma.InputJsonValue,
          error: null, completedAt: new Date(),
        },
      });
    });
    return { proposalCount: proposals.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resume analysis failed';
    await prisma.resumeAnalysis.update({
      where: { id: analysis.id }, data: { status: 'FAILED', error: message.slice(0, 1000) },
    }).catch(() => undefined);
    throw error;
  }
}

export const resumeAnalysisProcessor = new Worker<AnalysisJob>('resume-analysis', processAnalysis, { connection });
resumeAnalysisProcessor.on('failed', (job, error) => {
  console.error('Resume analysis failed', { jobId: job?.id, error: error.message });
});
export async function closeResumeAnalysisProcessor() {
  await resumeAnalysisProcessor.close();
  await connection.quit();
}
