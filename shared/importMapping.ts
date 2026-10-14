import type { ImportMapping, ImportTargetField } from './importSchemas';

const SYNONYMS: Record<ImportTargetField, string[]> = {
  name: ['name', 'partname', 'description', 'partdescription', 'title'],
  design_id: ['designid', 'designno', 'designnumber', 'part', 'partnum', 'partnumber', 'partno', 'partid', 'itemno'],
  category: ['category', 'partcategory', 'type'],
  subcategory: ['subcategory', 'subtype'],
  color: ['color', 'colour', 'colorname', 'colourname', 'colorid', 'colourid'],
  quantity: ['quantity', 'qty', 'count', 'owned', 'amount', 'have'],
  location: ['location', 'bin', 'drawer', 'storage', 'box'],
  notes: ['notes', 'note', 'comment', 'comments'],
  tags: ['tags', 'tag', 'labels'],
  kind: ['kind'],
  rebrickable_part_num: ['rebrickablepartnum', 'rebrickable'],
  ldraw_id: ['ldraw', 'ldrawid'],
  year_introduced: ['year', 'yearintroduced', 'yearreleased'],
};

function simplify(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Guesses which part field each column holds, using common header names. */
export function guessMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const used = new Set<ImportTargetField>();
  for (const header of headers) {
    const key = simplify(header);
    const field = (Object.keys(SYNONYMS) as ImportTargetField[]).find(
      (candidate) => !used.has(candidate) && SYNONYMS[candidate].includes(key),
    );
    mapping[header] = field ?? '';
    if (field) used.add(field);
  }
  return mapping;
}

/** Rebrickable part-list exports use "Part,Color,Quantity"; inventory files use part_num,color_id. */
export function looksLikeRebrickable(headers: string[]): boolean {
  const keys = headers.map(simplify);
  const hasPart = keys.includes('part') || keys.includes('partnum');
  const hasColor = keys.includes('color') || keys.includes('colorid');
  return hasPart && hasColor && keys.includes('quantity');
}

export function rebrickableMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  for (const header of headers) {
    const key = simplify(header);
    if (key === 'part' || key === 'partnum') mapping[header] = 'design_id';
    else if (key === 'color' || key === 'colorid') mapping[header] = 'color';
    else if (key === 'quantity') mapping[header] = 'quantity';
    else mapping[header] = '';
  }
  return mapping;
}
