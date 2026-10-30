import { careerProfilesDb } from './career-profiles.db.js';
import type {
  CertificationInput, EducationInput, ExperienceInput, PreferenceInput,
  ProfileInput, SkillInput,
} from './career-profiles.types.js';

const notFound = () => Object.assign(new Error('Career profile or requested record was not found'), { statusCode: 404, code: 'CAREER_PROFILE_NOT_FOUND' });

async function requireProfile(workspaceId: string, userId: string) {
  const profile = await careerProfilesDb.findProfile(workspaceId, userId);
  if (!profile) throw notFound();
  return profile;
}

async function requireAffected(count: number) {
  if (count === 0) throw notFound();
}

export const careerProfilesService = {
  getMine(workspaceId: string, userId: string) {
    return careerProfilesDb.findProfile(workspaceId, userId);
  },
  updateMine(workspaceId: string, userId: string, input: ProfileInput) {
    return careerProfilesDb.upsertProfile(workspaceId, userId, input);
  },

  async addExperience(workspaceId: string, userId: string, input: ExperienceInput) {
    const profile = await careerProfilesDb.upsertProfile(workspaceId, userId, {});
    return careerProfilesDb.createExperience(workspaceId, profile.id, input);
  },
  async updateExperience(workspaceId: string, userId: string, id: string, input: ExperienceInput) {
    const profile = await requireProfile(workspaceId, userId);
    const result = await careerProfilesDb.updateExperience(workspaceId, profile.id, id, input);
    await requireAffected(result.count);
    return { id };
  },
  async deleteExperience(workspaceId: string, userId: string, id: string) {
    const profile = await requireProfile(workspaceId, userId);
    const result = await careerProfilesDb.deleteExperience(workspaceId, profile.id, id);
    await requireAffected(result.count);
  },

  async addEducation(workspaceId: string, userId: string, input: EducationInput) {
    const profile = await careerProfilesDb.upsertProfile(workspaceId, userId, {});
    return careerProfilesDb.createEducation(workspaceId, profile.id, input);
  },
  async updateEducation(workspaceId: string, userId: string, id: string, input: EducationInput) {
    const profile = await requireProfile(workspaceId, userId);
    const result = await careerProfilesDb.updateEducation(workspaceId, profile.id, id, input);
    await requireAffected(result.count);
    return { id };
  },
  async deleteEducation(workspaceId: string, userId: string, id: string) {
    const profile = await requireProfile(workspaceId, userId);
    const result = await careerProfilesDb.deleteEducation(workspaceId, profile.id, id);
    await requireAffected(result.count);
  },

  async addCertification(workspaceId: string, userId: string, input: CertificationInput) {
    const profile = await careerProfilesDb.upsertProfile(workspaceId, userId, {});
    return careerProfilesDb.createCertification(workspaceId, profile.id, input);
  },
  async updateCertification(workspaceId: string, userId: string, id: string, input: CertificationInput) {
    const profile = await requireProfile(workspaceId, userId);
    const result = await careerProfilesDb.updateCertification(workspaceId, profile.id, id, input);
    await requireAffected(result.count);
    return { id };
  },
  async deleteCertification(workspaceId: string, userId: string, id: string) {
    const profile = await requireProfile(workspaceId, userId);
    const result = await careerProfilesDb.deleteCertification(workspaceId, profile.id, id);
    await requireAffected(result.count);
  },

  async upsertSkill(workspaceId: string, userId: string, input: SkillInput) {
    const profile = await careerProfilesDb.upsertProfile(workspaceId, userId, {});
    return careerProfilesDb.upsertSkill(workspaceId, profile.id, input);
  },
  async deleteSkill(workspaceId: string, userId: string, skillId: string) {
    const profile = await requireProfile(workspaceId, userId);
    const result = await careerProfilesDb.deleteSkill(workspaceId, profile.id, skillId);
    await requireAffected(result.count);
  },

  async updatePreferences(workspaceId: string, userId: string, input: PreferenceInput) {
    const profile = await careerProfilesDb.upsertProfile(workspaceId, userId, {});
    return careerProfilesDb.upsertPreferences(workspaceId, profile.id, input);
  },
};
