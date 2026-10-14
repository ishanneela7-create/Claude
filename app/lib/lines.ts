export interface GroupCount {
  key: string;
  count: number;
}

export type Line =
  | { kind: 'header'; key: string; count: number; collapsed: boolean }
  | { kind: 'cells'; start: number; length: number };

interface LineOptions {
  total: number;
  groups: GroupCount[] | null;
  collapsed: ReadonlySet<string>;
  columns: number;
}

function cellLines(start: number, count: number, columns: number): Line[] {
  const lines: Line[] = [];
  for (let offset = 0; offset < count; offset += columns) {
    lines.push({ kind: 'cells', start: start + offset, length: Math.min(columns, count - offset) });
  }
  return lines;
}

/**
 * Turns "N parts, maybe in groups" into the list of screen lines the virtual list draws.
 * Row numbers are positions in the full server result, so unloaded pages can be fetched by number.
 */
export function buildLines({ total, groups, collapsed, columns }: LineOptions): Line[] {
  const width = Math.max(1, columns);
  if (!groups) return cellLines(0, total, width);
  const lines: Line[] = [];
  let offset = 0;
  for (const group of groups) {
    const isCollapsed = collapsed.has(group.key);
    lines.push({ kind: 'header', key: group.key, count: group.count, collapsed: isCollapsed });
    if (!isCollapsed) lines.push(...cellLines(offset, group.count, width));
    offset += group.count;
  }
  return lines;
}
