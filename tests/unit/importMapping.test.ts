import { describe, expect, it } from 'vitest';
import { guessMapping, looksLikeRebrickable, rebrickableMapping } from '../../shared/importMapping';

describe('guessMapping', () => {
  it('guesses common header names', () => {
    expect(guessMapping(['Part Name', 'Design No', 'Colour', 'Qty', 'Bin', 'Whatever'])).toEqual({
      'Part Name': 'name',
      'Design No': 'design_id',
      Colour: 'color',
      Qty: 'quantity',
      Bin: 'location',
      Whatever: '',
    });
  });

  it('uses each field only once', () => {
    const mapping = guessMapping(['Name', 'Title']);
    expect(Object.values(mapping).filter((field) => field === 'name')).toHaveLength(1);
  });
});

describe('Rebrickable detection', () => {
  it('recognizes both export styles', () => {
    expect(looksLikeRebrickable(['Part', 'Color', 'Quantity'])).toBe(true);
    expect(
      looksLikeRebrickable(['inventory_id', 'part_num', 'color_id', 'quantity', 'is_spare']),
    ).toBe(true);
    expect(looksLikeRebrickable(['name', 'qty'])).toBe(false);
  });

  it('maps the Rebrickable columns', () => {
    expect(rebrickableMapping(['part_num', 'color_id', 'quantity', 'is_spare'])).toEqual({
      part_num: 'design_id',
      color_id: 'color',
      quantity: 'quantity',
      is_spare: '',
    });
  });
});
