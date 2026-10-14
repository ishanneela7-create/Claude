import { describe, expect, it } from 'vitest';
import { hasAnyFilter, parseQuantity, parseSearch } from '../../shared/searchQuery';

describe('parseSearch', () => {
  it('splits plain words', () => {
    expect(parseSearch('brick 2 x 4')).toEqual({ terms: ['brick', '2', 'x', '4'] });
  });

  it('reads every operator', () => {
    const parsed = parseSearch('color:red cat:plates loc:"Drawer 3" qty:>5 custom:true tag:rare');
    expect(parsed).toEqual({
      terms: [],
      color: 'red',
      category: 'plates',
      location: 'Drawer 3',
      quantity: { operator: '>', value: 5 },
      custom: true,
      tag: 'rare',
    });
  });

  it('mixes operators with words and keeps quoted phrases', () => {
    expect(parseSearch('"dark gray" slope color:blue')).toEqual({
      terms: ['dark gray', 'slope'],
      color: 'blue',
    });
  });

  it('understands the long operator names and any letter case', () => {
    expect(parseSearch('Category:Tiles LOCATION:bin1 Quantity:3')).toEqual({
      terms: [],
      category: 'Tiles',
      location: 'bin1',
      quantity: { operator: '=', value: 3 },
    });
  });

  it('treats a broken operator as a normal word', () => {
    expect(parseSearch('qty:lots custom:maybe color:')).toEqual({
      terms: ['qty:lots', 'custom:maybe', 'color:'],
    });
  });

  it('handles empty input and extra spaces', () => {
    expect(parseSearch('   ')).toEqual({ terms: [] });
    expect(parseSearch('  a   b ')).toEqual({ terms: ['a', 'b'] });
  });
});

describe('parseQuantity', () => {
  it.each([
    ['>5', '>', 5],
    ['<=10', '<=', 10],
    ['>=0', '>=', 0],
    ['<3', '<', 3],
    ['7', '=', 7],
    ['=8', '=', 8],
  ])('reads %s', (text, operator, value) => {
    expect(parseQuantity(text)).toEqual({ operator, value });
  });

  it('rejects junk', () => {
    expect(parseQuantity('>>5')).toBeUndefined();
    expect(parseQuantity('five')).toBeUndefined();
    expect(parseQuantity('')).toBeUndefined();
  });
});

describe('hasAnyFilter', () => {
  it('knows when there is something to search for', () => {
    expect(hasAnyFilter(parseSearch(''))).toBe(false);
    expect(hasAnyFilter(parseSearch('x'))).toBe(true);
    expect(hasAnyFilter(parseSearch('custom:false'))).toBe(true);
  });
});
