import type { z } from 'zod';
import type {
  certificationSchema, experienceSchema, educationSchema, profileSchema,
  preferenceSchema, skillSchema,
} from './career-profiles.validator.js';

export type ProfileInput = z.infer<typeof profileSchema>;
export type ExperienceInput = z.infer<typeof experienceSchema>;
export type EducationInput = z.infer<typeof educationSchema>;
export type CertificationInput = z.infer<typeof certificationSchema>;
export type PreferenceInput = z.infer<typeof preferenceSchema>;
export type SkillInput = z.infer<typeof skillSchema>;
