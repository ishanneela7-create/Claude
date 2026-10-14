import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '../../shared/csv';

describe('parseCsv', () => {
  it('reads simple rows and both kinds of line ending', () => {
    expect(parseCsv('a,b\r\n1,2\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('reads quotes, commas and line breaks inside quotes', () => {
    expect(parseCsv('name,note\n"Brick, 2x4","say ""hi""\nthere"')).toEqual([
      ['name', 'note'],
      ['Brick, 2x4', 'say "hi"\nthere'],
    ]);
  });

  it('skips blank lines and removes a byte order mark', () => {
    expect(parseCsv('﻿a,b\n\n1,2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps empty cells', () => {
    expect(parseCsv('a,,c\n,,')).toEqual([['a', '', 'c']]);
    expect(parseCsv('a,,c\n1,,')).toEqual([
      ['a', '', 'c'],
      ['1', '', ''],
    ]);
  });
});

describe('toCsv', () => {
  it('quotes only when needed and round-trips', () => {
    const rows = [
      ['name', 'note'],
      ['Brick, 2x4', 'say "hi"\nthere'],
      ['plain', null],
      ['n', 5],
    ];
    const text = toCsv(rows);
    expect(text).toContain('"Brick, 2x4"');
    expect(text).toContain('plain,\n');
    expect(parseCsv(text)).toEqual([
      ['name', 'note'],
      ['Brick, 2x4', 'say "hi"\nthere'],
      ['plain', ''],
      ['n', '5'],
    ]);
  });
});
