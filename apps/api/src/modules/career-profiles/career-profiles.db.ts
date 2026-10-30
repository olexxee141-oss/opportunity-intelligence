import { prisma } from '@oi/database';
import type {
  CertificationInput, EducationInput, ExperienceInput, PreferenceInput,
  ProfileInput, SkillInput,
} from './career-profiles.types.js';

export const careerProfilesDb = {
  findProfile(workspaceId: string, userId: string) {
    return prisma.careerProfile.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: {
        experiences: { orderBy: [{ sortOrder: 'asc' }, { startDate: 'desc' }] },
        educations: { orderBy: [{ sortOrder: 'asc' }, { startDate: 'desc' }] },
        certifications: { orderBy: { issuedAt: 'desc' } },
        skills: { include: { skill: true }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        preferences: true,
        resumes: {
          select: {
            id: true, fileName: true, mimeType: true, fileSizeBytes: true,
            status: true, parsedAt: true, createdAt: true, updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  },

  upsertProfile(workspaceId: string, userId: string, input: ProfileInput) {
    return prisma.careerProfile.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId, ...input },
      update: input,
    });
  },

  createExperience(workspaceId: string, careerProfileId: string, input: ExperienceInput) {
    return prisma.careerExperience.create({ data: { workspaceId, careerProfileId, ...input } });
  },
  updateExperience(workspaceId: string, careerProfileId: string, id: string, input: ExperienceInput) {
    return prisma.careerExperience.updateMany({ where: { id, workspaceId, careerProfileId }, data: input });
  },
  deleteExperience(workspaceId: string, careerProfileId: string, id: string) {
    return prisma.careerExperience.deleteMany({ where: { id, workspaceId, careerProfileId } });
  },

  createEducation(workspaceId: string, careerProfileId: string, input: EducationInput) {
    return prisma.careerEducation.create({ data: { workspaceId, careerProfileId, ...input } });
  },
  updateEducation(workspaceId: string, careerProfileId: string, id: string, input: EducationInput) {
    return prisma.careerEducation.updateMany({ where: { id, workspaceId, careerProfileId }, data: input });
  },
  deleteEducation(workspaceId: string, careerProfileId: string, id: string) {
    return prisma.careerEducation.deleteMany({ where: { id, workspaceId, careerProfileId } });
  },

  createCertification(workspaceId: string, careerProfileId: string, input: CertificationInput) {
    return prisma.careerCertification.create({ data: { workspaceId, careerProfileId, ...input } });
  },
  updateCertification(workspaceId: string, careerProfileId: string, id: string, input: CertificationInput) {
    return prisma.careerCertification.updateMany({ where: { id, workspaceId, careerProfileId }, data: input });
  },
  deleteCertification(workspaceId: string, careerProfileId: string, id: string) {
    return prisma.careerCertification.deleteMany({ where: { id, workspaceId, careerProfileId } });
  },

  async upsertSkill(workspaceId: string, careerProfileId: string, input: SkillInput) {
    const normalizedName = input.name.toLocaleLowerCase().trim().replace(/\\s+/g, ' ');
    return prisma.$transaction(async (tx) => {
      const skill = await tx.skill.upsert({
        where: { normalizedName },
        update: {},
        create: { name: input.name, normalizedName },
      });
      return tx.careerProfileSkill.upsert({
        where: { careerProfileId_skillId: { careerProfileId, skillId: skill.id } },
        update: { proficiency: input.proficiency, yearsExperience: input.yearsExperience, isPrimary: input.isPrimary },
        create: {
          workspaceId, careerProfileId, skillId: skill.id,
          proficiency: input.proficiency, yearsExperience: input.yearsExperience, isPrimary: input.isPrimary,
        },
        include: { skill: true },
      });
    });
  },
  deleteSkill(workspaceId: string, careerProfileId: string, skillId: string) {
    return prisma.careerProfileSkill.deleteMany({ where: { workspaceId, careerProfileId, skillId } });
  },

  async upsertPreferences(workspaceId: string, careerProfileId: string, input: PreferenceInput) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.careerPreference.findFirst({ where: { workspaceId, careerProfileId } });
      if (existing) return tx.careerPreference.update({ where: { id: existing.id }, data: input });
      return tx.careerPreference.create({ data: { workspaceId, careerProfileId, ...input } });
    });
  },
};
