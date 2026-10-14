import { z } from 'zod';
import { CATEGORIES, CUSTOM_SOURCES, MATERIALS } from '@shared/constants';
import { partInputSchema, type PartInput } from '@shared/partSchemas';
import type { PartRecord } from '@shared/types';

/** What the form holds: plain text for every box, converted to real types when saving. */
export const formValuesSchema = z.object({
  kind: z.enum(['official', 'custom']),
  name: z.string(),
  category: z.string(),
  subcategory: z.string(),
  color_id: z.string(),
  quantity: z.string(),
  location_id: z.string(),
  notes: z.string(),
  tags: z.array(z.string()),
  design_id: z.string(),
  rebrickable_part_num: z.string(),
  ldraw_id: z.string(),
  year_introduced: z.string(),
  source: z.string(),
  creator: z.string(),
  width_plates: z.string(),
  depth_plates: z.string(),
  height_plates: z.string(),
  stud_pattern: z.string(),
  material: z.string(),
  print_profile_notes: z.string(),
  parent_part_id: z.string(),
});

export type FormValues = z.infer<typeof formValuesSchema>;

const orNull = (text: string): string | null => (text.trim() === '' ? null : text.trim());
const numberOrNull = (text: string): number | null => (text.trim() === '' ? null : Number(text));

/** Turns form text into the shape the API expects. Bad numbers stay as NaN so Zod can complain. */
export function toPayload(values: FormValues): unknown {
  const shared = {
    name: values.name,
    category: values.category,
    subcategory: orNull(values.subcategory),
    color_id: values.color_id.trim() === '' ? Number.NaN : Number(values.color_id),
    quantity: values.quantity.trim() === '' ? 0 : Number(values.quantity),
    location_id: orNull(values.location_id),
    notes: orNull(values.notes),
    tags: values.tags,
  };
  if (values.kind === 'official') {
    return {
      kind: 'official',
      ...shared,
      design_id: values.design_id,
      rebrickable_part_num: orNull(values.rebrickable_part_num),
      ldraw_id: orNull(values.ldraw_id),
      year_introduced: numberOrNull(values.year_introduced),
    };
  }
  return {
    kind: 'custom',
    ...shared,
    source: values.source,
    creator: orNull(values.creator),
    width_plates: numberOrNull(values.width_plates),
    depth_plates: numberOrNull(values.depth_plates),
    height_plates: numberOrNull(values.height_plates),
    stud_pattern: orNull(values.stud_pattern),
    material: orNull(values.material),
    print_profile_notes: orNull(values.print_profile_notes),
    parent_part_id: orNull(values.parent_part_id),
  };
}

/** Form input in, checked PartInput out. Error paths match the form field names. */
export const partFormSchema = formValuesSchema.transform(toPayload).pipe(partInputSchema);

const text = (value: string | number | null | undefined): string =>
  value == null ? '' : String(value);

export function emptyValues(kind: PartInput['kind']): FormValues {
  return {
    kind,
    name: '',
    category: CATEGORIES[0],
    subcategory: '',
    color_id: '',
    quantity: '0',
    location_id: '',
    notes: '',
    tags: [],
    design_id: '',
    rebrickable_part_num: '',
    ldraw_id: '',
    year_introduced: '',
    source: CUSTOM_SOURCES[0],
    creator: '',
    width_plates: '',
    depth_plates: '',
    height_plates: '',
    stud_pattern: '',
    material: MATERIALS[0],
    print_profile_notes: '',
    parent_part_id: '',
  };
}

export function valuesFromPart(part: PartRecord): FormValues {
  return {
    ...emptyValues(part.kind),
    name: part.name,
    category: part.category,
    subcategory: text(part.subcategory),
    color_id: text(part.color_id),
    quantity: text(part.quantity),
    location_id: text(part.location_id),
    notes: text(part.notes),
    tags: part.tags,
    design_id: text(part.design_id),
    rebrickable_part_num: text(part.rebrickable_part_num),
    ldraw_id: text(part.ldraw_id),
    year_introduced: text(part.year_introduced),
    source: text(part.source) || CUSTOM_SOURCES[0],
    creator: text(part.creator),
    width_plates: text(part.width_plates),
    depth_plates: text(part.depth_plates),
    height_plates: text(part.height_plates),
    stud_pattern: text(part.stud_pattern),
    material: text(part.material),
    print_profile_notes: text(part.print_profile_notes),
    parent_part_id: text(part.parent_part_id),
  };
}
