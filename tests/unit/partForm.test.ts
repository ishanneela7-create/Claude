import { describe, expect, it } from 'vitest';
import { emptyValues, partFormSchema, toPayload, valuesFromPart } from '../../app/lib/partForm';
import type { PartRecord } from '../../shared/types';

describe('part form', () => {
  it('turns typed text into a valid official part', () => {
    const values = { ...emptyValues('official'), name: ' Brick ', design_id: '3001', color_id: '4', quantity: '12', year_introduced: '1995' };
    const result = partFormSchema.safeParse(values);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ kind: 'official', name: 'Brick', quantity: 12, year_introduced: 1995, subcategory: null });
  });

  it('reports errors on the same names as the form fields', () => {
    const result = partFormSchema.safeParse(emptyValues('official'));
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['name', 'design_id', 'color_id']));
  });

  it('checks custom part numbers and choices', () => {
    const base = { ...emptyValues('custom'), name: 'Gear', color_id: '1' };
    expect(partFormSchema.safeParse({ ...base, width_plates: '4', depth_plates: '2', height_plates: '3' }).success).toBe(true);
    expect(partFormSchema.safeParse({ ...base, width_plates: 'abc' }).success).toBe(false);
    expect(partFormSchema.safeParse({ ...base, width_plates: '-1' }).success).toBe(false);
    expect(partFormSchema.safeParse({ ...base, material: 'gold' }).success).toBe(false);
    expect(partFormSchema.safeParse({ ...base, material: '' }).success).toBe(true);
  });

  it('only sends fields that belong to the kind', () => {
    const official = toPayload({ ...emptyValues('official'), design_id: '1' }) as Record<string, unknown>;
    expect('source' in official).toBe(false);
    const custom = toPayload({ ...emptyValues('custom') }) as Record<string, unknown>;
    expect('design_id' in custom).toBe(false);
  });

  it('fills the form from a saved part', () => {
    const part = {
      kind: 'custom', name: 'Gear', category: 'Technic', color_id: 1, quantity: 3, location_id: 'loc', notes: null,
      tags: ['a'], source: '3d_printed', material: 'PLA', width_plates: 4, depth_plates: null, subcategory: null,
    } as unknown as PartRecord;
    expect(valuesFromPart(part)).toMatchObject({
      kind: 'custom', name: 'Gear', color_id: '1', quantity: '3', location_id: 'loc', notes: '',
      tags: ['a'], width_plates: '4', depth_plates: '', material: 'PLA',
    });
  });
});
