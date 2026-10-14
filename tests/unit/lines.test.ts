import { describe, expect, it } from 'vitest';
import { buildLines } from '../../app/lib/lines';

describe('buildLines', () => {
  it('makes one line per row in a table', () => {
    const lines = buildLines({ total: 3, groups: null, collapsed: new Set(), columns: 1 });
    expect(lines).toEqual([
      { kind: 'cells', start: 0, length: 1 },
      { kind: 'cells', start: 1, length: 1 },
      { kind: 'cells', start: 2, length: 1 },
    ]);
  });

  it('packs cards into lines for the grid, with a shorter last line', () => {
    const lines = buildLines({ total: 7, groups: null, collapsed: new Set(), columns: 3 });
    expect(lines.map((line) => (line.kind === 'cells' ? [line.start, line.length] : null))).toEqual(
      [
        [0, 3],
        [3, 3],
        [6, 1],
      ],
    );
  });

  it('adds group headers, and collapsed groups hide rows but keep row numbers right', () => {
    const groups = [
      { key: 'Bricks', count: 2 },
      { key: 'Plates', count: 3 },
    ];
    const open = buildLines({ total: 5, groups, collapsed: new Set(), columns: 1 });
    expect(open.map((line) => line.kind)).toEqual([
      'header',
      'cells',
      'cells',
      'header',
      'cells',
      'cells',
      'cells',
    ]);

    const collapsed = buildLines({ total: 5, groups, collapsed: new Set(['Bricks']), columns: 1 });
    expect(collapsed).toEqual([
      { kind: 'header', key: 'Bricks', count: 2, collapsed: true },
      { kind: 'header', key: 'Plates', count: 3, collapsed: false },
      { kind: 'cells', start: 2, length: 1 },
      { kind: 'cells', start: 3, length: 1 },
      { kind: 'cells', start: 4, length: 1 },
    ]);
  });

  it('copes with no rows and a column count below 1', () => {
    expect(buildLines({ total: 0, groups: null, collapsed: new Set(), columns: 2 })).toEqual([]);
    expect(buildLines({ total: 2, groups: null, collapsed: new Set(), columns: 0 })).toHaveLength(
      2,
    );
  });
});
