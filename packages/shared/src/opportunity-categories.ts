export const opportunityCategoryKeys = [
  'JOB',
  'INTERNSHIP',
  'SCHOLARSHIP',
  'GRANT',
  'FREELANCE',
  'HACKATHON',
  'COMPETITION',
  'FELLOWSHIP',
  'CONFERENCE',
  'RESEARCH',
  'VOLUNTEERING',
  'ACCELERATOR',
  'INCUBATOR',
  'OTHER',
] as const;

export type OpportunityCategoryKey = (typeof opportunityCategoryKeys)[number];

export const defaultOpportunityCategory: OpportunityCategoryKey = 'JOB';

export function isOpportunityCategoryKey(value: string): value is OpportunityCategoryKey {
  return (opportunityCategoryKeys as readonly string[]).includes(value);
}
