import { z } from 'zod';

const hexColor = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{6}$/, 'Use a 6 digit hex color like 0055BF')
  .transform((value) => value.replace('#', '').toUpperCase());

export const colorInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  rgb: hexColor,
  is_transparent: z.boolean().default(false),
  is_metallic: z.boolean().default(false),
});
export const colorPatchSchema = colorInputSchema.partial().strict();

export const locationInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  parent_id: z.string().min(1).nullish(),
  level_label: z.string().trim().max(40).nullish(),
  label: z.string().trim().max(100).nullish(),
  color_code: hexColor.nullish(),
});
export const locationPatchSchema = locationInputSchema.partial().strict();
export const locationMoveSchema = z.object({ parent_id: z.string().min(1).nullable() });
export const locationDeleteQuerySchema = z.object({
  move_to: z.string().min(1).optional(),
});

export const tagInputSchema = z.object({ name: z.string().trim().min(1).max(50) });

export const idParamSchema = z.object({ id: z.string().min(1).max(100) });
export const colorIdParamSchema = z.object({ id: z.coerce.number().int() });

export const customPartImportSchema = z.object({
  format: z.literal('lego-library-custom-part'),
  formatVersion: z.literal(1),
  part: z.record(z.string(), z.unknown()),
  color: z.object({ name: z.string(), rgb: z.string() }).optional(),
  versions: z.array(z.record(z.string(), z.unknown())).optional(),
});

export type ColorInput = z.infer<typeof colorInputSchema>;
export type LocationInput = z.infer<typeof locationInputSchema>;
