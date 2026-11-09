import { describe, expect, it } from 'vitest';
import geographyJson from '../public/geography.json';
import { lookupLocation, type Geography } from '../src/geography';

const geography = geographyJson as unknown as Geography;

describe('offline position labels', () => {
  it('identifies the approximate region within countries', () => {
    expect(lookupLocation(geography, 42.5, -73)).toBe('美國東北部');
    expect(lookupLocation(geography, 51.2, -2.5)).toBe('英國南部');
    expect(lookupLocation(geography, 48.5, -4.5)).toBe('法國西北部');
  });

  it('identifies named seas and oceans', () => {
    expect(lookupLocation(geography, 43.5, 9)).toBe('利古里亞海');
    expect(lookupLocation(geography, 56, 3)).toBe('北海');
    expect(lookupLocation(geography, 15, 114)).toBe('南海');
    expect(lookupLocation(geography, 0, 180)).toContain('太平洋');
    expect(lookupLocation(geography, 0, -180)).toBe(lookupLocation(geography, 0, 180));
  });
});
