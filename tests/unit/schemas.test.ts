import { describe, expect, it } from 'vitest';
import { importMappingSchema } from '../../shared/importSchemas';
import { colorInputSchema, locationInputSchema } from '../../shared/otherSchemas';
import { bulkEditSchema, partInputSchema, partPatchSchema } from '../../shared/partSchemas';
import { partListQuerySchema, smartViewInputSchema } from '../../shared/querySchemas';

const official = { kind: 'official', name: 'Brick', category: 'Bricks', color_id: 4, design_id: '3001' };

describe('part schemas', () => {
  it('accepts an official part and fills defaults', () => {
    const result = partInputSchema.parse(official);
    expect(result).toMatchObject({ quantity: 0, tags: [] });
  });

  it('rejects unknown categories, negative quantities and blank names', () => {
    expect(partInputSchema.safeParse({ ...official, category: 'Food' }).success).toBe(false);
    expect(partInputSchema.safeParse({ ...official, quantity: -1 }).success).toBe(false);
    expect(partInputSchema.safeParse({ ...official, name: '   ' }).success).toBe(false);
    expect(partInputSchema.safeParse({ ...official, quantity: 1.5 }).success).toBe(false);
  });

  it('needs the right fields for each kind', () => {
    expect(partInputSchema.safeParse({ ...official, design_id: undefined }).success).toBe(false);
    const custom = { kind: 'custom', name: 'Gear', category: 'Technic', color_id: 1 };
    expect(partInputSchema.safeParse(custom).success).toBe(false);
    expect(partInputSchema.safeParse({ ...custom, source: '3d_printed', material: 'PLA' }).success).toBe(true);
    expect(partInputSchema.safeParse({ ...custom, source: 'magic' }).success).toBe(false);
    expect(partInputSchema.safeParse({ ...custom, source: 'other', width_plates: -2 }).success).toBe(false);
  });

  it('limits the year', () => {
    expect(partInputSchema.safeParse({ ...official, year_introduced: 1900 }).success).toBe(false);
    expect(partInputSchema.safeParse({ ...official, year_introduced: 1999 }).success).toBe(true);
  });

  it('patches allow partial data but not the kind or unknown fields', () => {
    expect(partPatchSchema.safeParse({ quantity: 3 }).success).toBe(true);
    expect(partPatchSchema.safeParse({ kind: 'custom' }).success).toBe(false);
    expect(partPatchSchema.safeParse({ color: 'red' }).success).toBe(false);
  });

  it('bulk edits need ids and at least one change', () => {
    expect(bulkEditSchema.safeParse({ ids: ['a'], changes: { quantity: 2 } }).success).toBe(true);
    expect(bulkEditSchema.safeParse({ ids: ['a'], changes: {} }).success).toBe(false);
    expect(bulkEditSchema.safeParse({ ids: [], changes: { quantity: 2 } }).success).toBe(false);
  });
});

describe('other schemas', () => {
  it('normalizes colors to upper case without #', () => {
    expect(colorInputSchema.parse({ name: 'Sky', rgb: '#0a1B2c' }).rgb).toBe('0A1B2C');
    expect(colorInputSchema.safeParse({ name: 'Sky', rgb: '123' }).success).toBe(false);
  });

  it('checks locations', () => {
    expect(locationInputSchema.safeParse({ name: 'Bin', color_code: '00ff88' }).success).toBe(true);
    expect(locationInputSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('reads list queries from text and applies defaults and limits', () => {
    const query = partListQuerySchema.parse({ limit: '50', low_stock: 'true', color_id: '4' });
    expect(query).toMatchObject({ limit: 50, low_stock: true, color_id: 4, sort: 'name', dir: 'asc', offset: 0 });
    expect(partListQuerySchema.safeParse({ limit: '100000' }).success).toBe(false);
    expect(partListQuerySchema.safeParse({ dir: 'sideways' }).success).toBe(false);
  });

  it('checks smart views and import mappings', () => {
    expect(smartViewInputSchema.safeParse({ name: 'x', filter: { low_stock: 'true' } }).success).toBe(true);
    expect(importMappingSchema.safeParse({ A: 'name', B: '' }).success).toBe(true);
    expect(importMappingSchema.safeParse({ A: 'banana' }).success).toBe(false);
  });
});
