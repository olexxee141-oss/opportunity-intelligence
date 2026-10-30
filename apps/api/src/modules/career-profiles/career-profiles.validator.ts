import { z } from 'zod';

const optionalText = (max = 500) => z.string().trim().max(max).nullable().optional();
const dateValue = z.union([z.string().datetime().transform((value) => new Date(value)), z.date()]).nullable().optional();
const employmentTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP', 'FREELANCE'] as const;
const workModes = ['ONSITE', 'HYBRID', 'REMOTE'] as const;
const proficiencyLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;

export const profileSchema = z.object({
  headline: optionalText(160),
  professionalSummary: optionalText(5000),
  currentLocation: optionalText(160),
  yearsOfExperience: z.number().int().min(0).max(80).nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  portfolioUrl: z.string().url().nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
}).strict();

export const experienceSchema = z.object({
  title: z.string().trim().min(1).max(160),
  company: z.string().trim().min(1).max(160),
  location: optionalText(160),
  employmentType: z.enum(employmentTypes).nullable().optional(),
  startDate: dateValue,
  endDate: dateValue,
  isCurrent: z.boolean().default(false),
  description: optionalText(5000),
  achievements: z.array(z.string().trim().min(1).max(1000)).max(30).default([]),
  sortOrder: z.number().int().min(0).max(10000).default(0),
}).strict().superRefine((value, context) => {
  if (value.isCurrent && value.endDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Current roles cannot have an end date' });
  if (value.startDate && value.endDate && value.endDate < value.startDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date must be after start date' });
});

export const educationSchema = z.object({
  institution: z.string().trim().min(1).max(200),
  qualification: optionalText(160),
  fieldOfStudy: optionalText(160),
  location: optionalText(160),
  startDate: dateValue,
  endDate: dateValue,
  grade: optionalText(80),
  description: optionalText(3000),
  sortOrder: z.number().int().min(0).max(10000).default(0),
}).strict().superRefine((value, context) => {
  if (value.startDate && value.endDate && value.endDate < value.startDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date must be after start date' });
});

export const certificationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  issuer: optionalText(160),
  credentialId: optionalText(160),
  credentialUrl: z.string().url().nullable().optional(),
  issuedAt: dateValue,
  expiresAt: dateValue,
  doesNotExpire: z.boolean().default(false),
}).strict().superRefine((value, context) => {
  if (value.doesNotExpire && value.expiresAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ['expiresAt'], message: 'Non-expiring certifications cannot have an expiry date' });
  if (value.issuedAt && value.expiresAt && value.expiresAt < value.issuedAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ['expiresAt'], message: 'Expiry date must be after issue date' });
});

export const skillSchema = z.object({
  name: z.string().trim().min(1).max(100),
  proficiency: z.enum(proficiencyLevels).nullable().optional(),
  yearsExperience: z.number().min(0).max(80).multipleOf(0.1).nullable().optional(),
  isPrimary: z.boolean().default(false),
}).strict();

export const preferenceSchema = z.object({
  desiredJobTitles: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  preferredLocations: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  industries: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  employmentTypes: z.array(z.enum(employmentTypes)).max(6).default([]),
  workModes: z.array(z.enum(workModes)).max(3).default([]),
  minSalaryAmount: z.number().positive().max(1000000000).nullable().optional(),
  maxSalaryAmount: z.number().positive().max(1000000000).nullable().optional(),
  salaryCurrency: z.string().trim().length(3).toUpperCase().nullable().optional(),
  salaryPeriod: z.enum(['HOURLY', 'MONTHLY', 'ANNUAL']).nullable().optional(),
  willingToRelocate: z.boolean().default(false),
  requiresSponsorship: z.boolean().nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.minSalaryAmount != null && value.maxSalaryAmount != null && value.minSalaryAmount > value.maxSalaryAmount) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['maxSalaryAmount'], message: 'Maximum salary must be greater than or equal to minimum salary' });
  }
});

export const idParamsSchema = z.object({ id: z.string().uuid() }).strict();
