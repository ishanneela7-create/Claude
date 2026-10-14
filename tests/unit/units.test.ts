import { describe, expect, it } from 'vitest';
import { formatDimensions, millimetresToPlateUnits } from '../../shared/units';

describe('millimetresToPlateUnits', () => {
  it('converts a 2 x 4 brick size (16 x 32 x 9.6 mm) to studs and plates', () => {
    expect(millimetresToPlateUnits(31.8, 15.8, 9.6)).toEqual({ width: 4, depth: 2, height: 3 });
  });

  it('never goes below 1', () => {
    expect(millimetresToPlateUnits(0.5, 0.1, 0.2)).toEqual({ width: 1, depth: 1, height: 1 });
  });

  it('rounds to the nearest whole stud and plate', () => {
    expect(millimetresToPlateUnits(20, 20, 5)).toEqual({ width: 3, depth: 3, height: 2 });
  });
});

describe('formatDimensions', () => {
  it('formats complete sizes and hides missing ones', () => {
    expect(formatDimensions(4, 2, 3)).toBe('4 x 2 x 3');
    expect(formatDimensions(4, null, 3)).toBe('');
  });
});
