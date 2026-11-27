import { z } from 'zod';
import { LOCALES } from './locales.ts';

/** Business categories offered in the UI (stored as text codes; DB allows 1–64 chars). */
export const WORKSPACE_CATEGORIES = [
  'restaurant',
  'cafe',
  'retail',
  'ecommerce',
  'clinic',
  'beauty',
  'services',
  'education',
  'real_estate',
  'other',
] as const;
export type WorkspaceCategory = (typeof WORKSPACE_CATEGORIES)[number];

/** Gulf-first country shortlist shown at the top of the picker (ISO 3166-1 alpha-2). */
export const PRIORITY_COUNTRIES = ['SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'EG', 'JO'] as const;

/** Same rule as the DB check `workspaces.slug` (0002): 3–48 chars, a–z 0–9 and inner dashes. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;

/**
 * Suggests a slug from a workspace name. Arabic (or other non-Latin) names produce no Latin
 * characters, so a short random suffix is used instead: the user can edit it.
 */
export function slugify(name: string, random: () => number = Math.random): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  if (base.length >= 3) return base;
  const suffix = Math.floor(random() * 0xffffff)
    .toString(36)
    .padStart(5, '0')
    .slice(0, 5);
  return base ? `${base}-${suffix}` : `ws-${suffix}`;
}

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, { error: 'validation.required' })
  .max(120, { error: 'validation.too_long' });

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(SLUG_PATTERN, { error: 'validation.slug_format' });

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
  slug: slugSchema,
  category: z.enum(WORKSPACE_CATEGORIES, { error: 'validation.required' }),
  country_code: z
    .string()
    .regex(/^[A-Z]{2}$/, { error: 'validation.required' })
    .nullable(),
  timezone: z.string().min(1, { error: 'validation.required' }).max(64),
  default_locale: z.enum(LOCALES),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

/** Fields an owner/admin may edit directly through RLS (column grants in 0002). */
export const updateWorkspaceSchema = createWorkspaceSchema.omit({ slug: true });
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
