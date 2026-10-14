import { LOW_STOCK_THRESHOLD } from '@shared/constants';
import type { PartFilter } from '@shared/querySchemas';
import { parseSearch } from '@shared/searchQuery';
import { buildMatchExpression } from './searchIndex';

export interface BuiltFilter {
  where: string;
  params: Array<string | number>;
  /** Plain words that FTS could not match; used by the fuzzy fallback. */
  terms: string[];
  hasText: boolean;
}

function likeValue(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

const NEEDS_SORTING_TAGS = "('needs sorting', 'needs-sorting')";

/** Builds the WHERE part of a part list query from saved filters and the search box. */
export function buildFilter(filter: PartFilter, idList?: string[]): BuiltFilter {
  const clauses: string[] = ['p.deleted_at IS NULL', 'p.is_current = 1'];
  const params: Array<string | number> = [];
  const parsed = parseSearch(filter.q ?? '');

  const match = buildMatchExpression(parsed.terms);
  if (idList) {
    clauses.push(`p.id IN (${idList.map(() => '?').join(',') || "''"})`);
    params.push(...idList);
  } else if (match) {
    clauses.push('p.id IN (SELECT part_id FROM parts_search WHERE parts_search MATCH ?)');
    params.push(match);
  }

  if (parsed.color) {
    clauses.push("c.name LIKE ? ESCAPE '\\'");
    params.push(likeValue(parsed.color));
  }
  if (parsed.category) {
    clauses.push("p.category LIKE ? ESCAPE '\\'");
    params.push(likeValue(parsed.category));
  }
  if (parsed.location) {
    clauses.push("l.path LIKE ? ESCAPE '\\'");
    params.push(likeValue(parsed.location));
  }
  if (parsed.tag) {
    clauses.push(
      `EXISTS (SELECT 1 FROM part_tags pt JOIN tags t ON t.id = pt.tag_id
               WHERE pt.part_id = p.id AND t.name = ?)`,
    );
    params.push(parsed.tag);
  }
  if (parsed.quantity) {
    clauses.push(`p.quantity ${parsed.quantity.operator} ?`);
    params.push(parsed.quantity.value);
  }
  if (parsed.custom !== undefined) clauses.push(`p.kind = '${parsed.custom ? 'custom' : 'official'}'`);

  if (filter.kind) {
    clauses.push('p.kind = ?');
    params.push(filter.kind);
  }
  if (filter.category) {
    clauses.push('p.category = ?');
    params.push(filter.category);
  }
  if (filter.color_id !== undefined) {
    clauses.push('p.color_id = ?');
    params.push(filter.color_id);
  }
  if (filter.location_id) {
    clauses.push(
      `p.location_id IN (SELECT d.id FROM locations d, locations r WHERE r.id = ?
         AND substr(d.id_path, 1, length(r.id_path)) = r.id_path)`,
    );
    params.push(filter.location_id);
  }
  if (filter.tag) {
    clauses.push(
      `EXISTS (SELECT 1 FROM part_tags pt JOIN tags t ON t.id = pt.tag_id
               WHERE pt.part_id = p.id AND t.name = ?)`,
    );
    params.push(filter.tag);
  }
  if (filter.low_stock) {
    clauses.push('p.quantity <= ?');
    params.push(LOW_STOCK_THRESHOLD);
  }
  if (filter.missing_location) clauses.push('p.location_id IS NULL');
  if (filter.needs_sorting) {
    clauses.push(
      `EXISTS (SELECT 1 FROM part_tags pt JOIN tags t ON t.id = pt.tag_id
               WHERE pt.part_id = p.id AND t.name IN ${NEEDS_SORTING_TAGS})`,
    );
  }

  return {
    where: clauses.join(' AND '),
    params,
    terms: parsed.terms,
    hasText: match !== null,
  };
}
