import { Prisma } from '@prisma/client';
import { prisma } from '@oi/database';

function parseResumeDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const normalized = /^\d{4}-\d{2}$/.test(value) ? value + '-01T00:00:00.000Z' : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const resumeAnalysisDb = {
  findReadyResume(workspaceId: string, userId: string, resumeId: string) {
    return prisma.resume.findFirst({
      where: { id: resumeId, workspaceId, careerProfile: { userId }, status: 'READY' },
      select: { id: true, careerProfileId: true, extractedText: true },
    });
  },
  findActive(workspaceId: string, resumeId: string) {
    return prisma.resumeAnalysis.findFirst({
      where: { workspaceId, resumeId, status: { in: ['QUEUED', 'PROCESSING'] } },
      select: { id: true },
    });
  },
  createQueued(input: { workspaceId: string; careerProfileId: string; resumeId: string; provider: string; model: string }) {
    return prisma.resumeAnalysis.create({ data: input, select: { id: true, status: true, createdAt: true } });
  },
  markFailed(id: string, message: string) {
    return prisma.resumeAnalysis.update({ where: { id }, data: { status: 'FAILED', error: message.slice(0, 1000) } });
  },
  listOwned(workspaceId: string, userId: string, resumeId: string) {
    return prisma.resumeAnalysis.findMany({
      where: { workspaceId, resumeId, resume: { careerProfile: { userId } } },
      select: {
        id: true, status: true, provider: true, model: true, summary: true,
        missingInformation: true, weakAreas: true, error: true,
        completedAt: true, createdAt: true, updatedAt: true,
        _count: { select: { proposals: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },
  findOwned(workspaceId: string, userId: string, resumeId: string, analysisId: string) {
    return prisma.resumeAnalysis.findFirst({
      where: { id: analysisId, workspaceId, resumeId, resume: { careerProfile: { userId } } },
      include: { proposals: { orderBy: { createdAt: 'asc' } } },
    });
  },
  async reviewProposal(input: {
    workspaceId: string; userId: string; resumeId: string; analysisId: string; proposalId: string; decision: 'ACCEPT' | 'REJECT';
  }) {
    return prisma.$transaction(async (tx) => {
      const proposal = await tx.resumeProfileProposal.findFirst({
        where: {
          id: input.proposalId, workspaceId: input.workspaceId, analysisId: input.analysisId,
          status: 'PENDING',
          analysis: { resumeId: input.resumeId, resume: { careerProfile: { userId: input.userId } } },
        },
        include: { analysis: { select: { careerProfileId: true } } },
      });
      if (!proposal) return null;
      if (input.decision === 'ACCEPT') {
        const payload = proposal.payload as Record<string, unknown>;
        const careerProfileId = proposal.analysis.careerProfileId;
        if (proposal.type === 'PROFILE_FIELD') {
          const field = payload.field;
          const value = payload.value;
          let profileUpdate:
            | { headline: string }
            | { professionalSummary: string }
            | { currentLocation: string }
            | { yearsOfExperience: number }
            | { linkedinUrl: string }
            | { portfolioUrl: string }
            | { websiteUrl: string };
          if (field === 'headline' && typeof value === 'string') profileUpdate = { headline: value };
          else if (field === 'professionalSummary' && typeof value === 'string') profileUpdate = { professionalSummary: value };
          else if (field === 'currentLocation' && typeof value === 'string') profileUpdate = { currentLocation: value };
          else if (field === 'yearsOfExperience' && typeof value === 'number') profileUpdate = { yearsOfExperience: value };
          else if (field === 'linkedinUrl' && typeof value === 'string') profileUpdate = { linkedinUrl: value };
          else if (field === 'portfolioUrl' && typeof value === 'string') profileUpdate = { portfolioUrl: value };
          else if (field === 'websiteUrl' && typeof value === 'string') profileUpdate = { websiteUrl: value };
          else throw new Error('Unsupported or invalid profile proposal field');
          await tx.careerProfile.update({ where: { id: careerProfileId }, data: profileUpdate });
        } else if (proposal.type === 'EXPERIENCE') {
          await tx.careerExperience.create({
            data: {
              workspaceId: input.workspaceId, careerProfileId,
              title: String(payload.title), company: String(payload.company),
              location: typeof payload.location === 'string' ? payload.location : null,
              startDate: parseResumeDate(payload.startDate), endDate: parseResumeDate(payload.endDate),
              isCurrent: payload.isCurrent === true,
              description: typeof payload.description === 'string' ? payload.description : null,
              achievements: Array.isArray(payload.achievements) ? payload.achievements.filter((item): item is string => typeof item === 'string') : [],
            },
          });
        } else if (proposal.type === 'EDUCATION') {
          await tx.careerEducation.create({
            data: {
              workspaceId: input.workspaceId, careerProfileId,
              institution: String(payload.institution),
              qualification: typeof payload.qualification === 'string' ? payload.qualification : null,
              fieldOfStudy: typeof payload.fieldOfStudy === 'string' ? payload.fieldOfStudy : null,
              location: typeof payload.location === 'string' ? payload.location : null,
              startDate: parseResumeDate(payload.startDate), endDate: parseResumeDate(payload.endDate),
              grade: typeof payload.grade === 'string' ? payload.grade : null,
              description: typeof payload.description === 'string' ? payload.description : null,
            },
          });
        } else if (proposal.type === 'CERTIFICATION') {
          await tx.careerCertification.create({
            data: {
              workspaceId: input.workspaceId, careerProfileId,
              name: String(payload.name),
              issuer: typeof payload.issuer === 'string' ? payload.issuer : null,
              credentialId: typeof payload.credentialId === 'string' ? payload.credentialId : null,
              credentialUrl: typeof payload.credentialUrl === 'string' ? payload.credentialUrl : null,
              issuedAt: parseResumeDate(payload.issuedAt), expiresAt: parseResumeDate(payload.expiresAt),
              doesNotExpire: payload.doesNotExpire === true,
            },
          });
        } else if (proposal.type === 'SKILL') {
          const name = String(payload.name).trim();
          const normalizedName = name.toLocaleLowerCase().replace(/\s+/g, ' ');
          const skill = await tx.skill.upsert({ where: { normalizedName }, update: {}, create: { name, normalizedName } });
          const proficiency = payload.proficiency === 'BEGINNER' || payload.proficiency === 'INTERMEDIATE' || payload.proficiency === 'ADVANCED' || payload.proficiency === 'EXPERT' ? payload.proficiency : null;
          const yearsExperience = typeof payload.yearsExperience === 'number' ? payload.yearsExperience : null;
          await tx.careerProfileSkill.upsert({
            where: { careerProfileId_skillId: { careerProfileId, skillId: skill.id } },
            update: { proficiency, yearsExperience },
            create: { workspaceId: input.workspaceId, careerProfileId, skillId: skill.id, proficiency, yearsExperience },
          });
        }
      }
      return tx.resumeProfileProposal.update({
        where: { id: proposal.id },
        data: { status: input.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED', reviewedAt: new Date() },
      });
    });
  },
};
