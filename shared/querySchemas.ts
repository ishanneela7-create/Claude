import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PART_KINDS, SORT_FIELDS } from './constants';

const booleanFromText = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .or(z.boolean());

/** Filters that a smart view can save. */
export const partFilterSchema = z.object({
  q: z.string().max(300).optional(),
  kind: z.enum(PART_KINDS).optional(),
  category: z.string().max(100).optional(),
  color_id: z.coerce.number().int().optional(),
  location_id: z.string().max(100).optional(),
  tag: z.string().max(100).optional(),
  low_stock: booleanFromText.optional(),
  missing_location: booleanFromText.optional(),
  needs_sorting: booleanFromText.optional(),
});

export const partListQuerySchema = partFilterSchema.extend({
  sort: z.enum(SORT_FIELDS).default('name'),
  dir: z.enum(['asc', 'desc']).default('asc'),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export const smartViewInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  filter: partFilterSchema.partial(),
});

export type PartFilter = z.infer<typeof partFilterSchema>;
export type PartListQuery = z.infer<typeof partListQuerySchema>;
export type SmartViewInput = z.infer<typeof smartViewInputSchema>;
