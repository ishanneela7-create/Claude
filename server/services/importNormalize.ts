import type { Database } from 'better-sqlite3';
import { CATEGORIES } from '@shared/constants';
import type { ImportMapping, ImportTargetField } from '@shared/importSchemas';
import type { PartInput } from '@shared/partSchemas';

export interface NormalizedRow {
  input: PartInput;
  locationPath: string | null;
}

export type RowResult = { ok: true; row: NormalizedRow } | { ok: false; error: string };

interface ColorCache {
  byName: Map<string, number>;
  byId: Set<number>;
}

export function loadColorCache(db: Database): ColorCache {
  const rows = db.prepare('SELECT id, name FROM colors').all() as { id: number; name: string }[];
  return {
    byName: new Map(rows.map((row) => [row.name.toLowerCase(), row.id])),
    byId: new Set(rows.map((row) => row.id)),
  };
}

function resolveColor(text: string, cache: ColorCache, preferId: boolean): number | null {
  const trimmed = text.trim();
  const asNumber = Number(trimmed);
  const isNumber = trimmed !== '' && Number.isInteger(asNumber);
  if (preferId && isNumber && cache.byId.has(asNumber)) return asNumber;
  const byName = cache.byName.get(trimmed.toLowerCase());
  if (byName !== undefined) return byName;
  if (isNumber && cache.byId.has(asNumber)) return asNumber;
  return null;
}

function resolveCategory(text: string): PartInput['category'] {
  const match = CATEGORIES.find((category) => category.toLowerCase() === text.trim().toLowerCase());
  return match ?? 'Specialty';
}

/** Turns one CSV row into a part, or says what is wrong with it. */
export function normalizeRow(
  headers: string[],
  cells: string[],
  mapping: ImportMapping,
  cache: ColorCache,
  rebrickable: boolean,
): RowResult {
  const value = (field: ImportTargetField): string => {
    const header = headers.find((candidate) => mapping[candidate] === field);
    if (header === undefined) return '';
    return (cells[headers.indexOf(header)] ?? '').trim();
  };

  const designId = value('design_id');
  const colorText = value('color');
  const name = value('name') || (rebrickable && designId ? `Part ${designId}` : '');
  const kind = value('kind').toLowerCase() === 'custom' ? 'custom' : 'official';

  if (!name) return { ok: false, error: 'Missing name' };
  if (kind === 'official' && !designId) return { ok: false, error: 'Missing design id' };
  const colorId = resolveColor(colorText, cache, rebrickable);
  if (colorId === null) return { ok: false, error: `Unknown color "${colorText}"` };

  const quantityText = value('quantity');
  const quantity = quantityText === '' ? 0 : Number(quantityText);
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { ok: false, error: `Quantity "${quantityText}" is not a whole number` };
  }
  const yearText = value('year_introduced');
  const year = yearText ? Number(yearText) : null;
  if (year !== null && (!Number.isInteger(year) || year < 1949 || year > 2100)) {
    return { ok: false, error: `Year "${yearText}" is not valid` };
  }

  const shared = {
    name,
    category: resolveCategory(value('category')),
    subcategory: value('subcategory') || null,
    color_id: colorId,
    quantity,
    location_id: null,
    notes: value('notes') || null,
    tags: value('tags')
      .split(/[;|]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
  const input: PartInput =
    kind === 'custom'
      ? { kind: 'custom', ...shared, source: 'other' }
      : {
          kind: 'official',
          ...shared,
          design_id: designId,
          rebrickable_part_num: value('rebrickable_part_num') || (rebrickable ? designId : null),
          ldraw_id: value('ldraw_id') || null,
          year_introduced: year,
        };
  return { ok: true, row: { input, locationPath: value('location') || null } };
}
