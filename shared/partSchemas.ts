import { z } from 'zod';
import { CATEGORIES, CUSTOM_SOURCES, MATERIALS } from './constants';

const optionalText = (max: number) => z.string().trim().max(max).nullish();

const sharedFields = {
  name: z.string().trim().min(1, 'Name is required').max(200),
  category: z.enum(CATEGORIES),
  subcategory: optionalText(100),
  color_id: z.number().int(),
  quantity: z.number().int().min(0).default(0),
  location_id: z.string().min(1).nullish(),
  notes: optionalText(20000),
  tags: z.array(z.string().trim().min(1).max(50)).max(50).default([]),
  image_path: optionalText(500),
};

const officialFields = {
  design_id: z.string().trim().min(1, 'Design id is required').max(40),
  rebrickable_part_num: optionalText(40),
  ldraw_id: optionalText(40),
  year_introduced: z.number().int().min(1949).max(2100).nullish(),
};

const dimension = z.number().positive().max(1000).nullish();

const customFields = {
  source: z.enum(CUSTOM_SOURCES),
  creator: optionalText(100),
  width_plates: dimension,
  depth_plates: dimension,
  height_plates: dimension,
  stud_pattern: optionalText(500),
  material: z.enum(MATERIALS).nullish(),
  print_profile_notes: optionalText(5000),
  parent_part_id: z.string().min(1).nullish(),
};

export const officialPartInputSchema = z.object({
  kind: z.literal('official'),
  ...sharedFields,
  ...officialFields,
});

export const customPartInputSchema = z.object({
  kind: z.literal('custom'),
  ...sharedFields,
  ...customFields,
});

export const partInputSchema = z.discriminatedUnion('kind', [
  officialPartInputSchema,
  customPartInputSchema,
]);

/** Edits may change any field except the kind. The service rejects fields from the other kind. */
export const partPatchSchema = z
  .object({
    ...sharedFields,
    ...officialFields,
    ...customFields,
    quantity: sharedFields.quantity.unwrap(),
    tags: z.array(z.string().trim().min(1).max(50)).max(50),
  })
  .partial()
  .strict();

export const bulkEditSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(5000),
  changes: z
    .object({
      location_id: z.string().min(1).nullable().optional(),
      quantity: z.number().int().min(0).optional(),
      quantity_delta: z.number().int().optional(),
      add_tags: z.array(z.string().trim().min(1).max(50)).optional(),
      remove_tags: z.array(z.string().trim().min(1).max(50)).optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, 'Pick at least one change'),
});

export const mergeSchema = z.object({
  keep_id: z.string().min(1),
  merge_ids: z.array(z.string().min(1)).min(1),
});

export type PartInput = z.infer<typeof partInputSchema>;
export type PartPatch = z.infer<typeof partPatchSchema>;
export type BulkEdit = z.infer<typeof bulkEditSchema>;
export type MergeRequest = z.infer<typeof mergeSchema>;
