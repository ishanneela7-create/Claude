import { z } from 'zod';

/** Fields a CSV column can be mapped to. */
export const IMPORT_TARGET_FIELDS = [
  'name',
  'design_id',
  'category',
  'subcategory',
  'color',
  'quantity',
  'location',
  'notes',
  'tags',
  'kind',
  'rebrickable_part_num',
  'ldraw_id',
  'year_introduced',
  'source',
  'creator',
  'material',
  'width_plates',
  'depth_plates',
  'height_plates',
  'stud_pattern',
] as const;

export type ImportTargetField = (typeof IMPORT_TARGET_FIELDS)[number];

export const importMappingSchema = z.record(
  z.string(),
  z.enum(IMPORT_TARGET_FIELDS).or(z.literal('')),
);

export const importPreviewSchema = z.object({
  format: z.enum(['csv', 'rebrickable']),
  text: z.string().min(1).max(50_000_000),
});

export const importRunSchema = importPreviewSchema.extend({
  source_name: z.string().trim().min(1).max(200).default('import.csv'),
  mapping: importMappingSchema.optional(),
});

export const historyActionSchema = z.object({ steps: z.number().int().min(1).max(100).default(1) });

export type ImportMapping = z.infer<typeof importMappingSchema>;
export type ImportRunRequest = z.infer<typeof importRunSchema>;
