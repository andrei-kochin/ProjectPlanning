import { describe, expect, it } from 'vitest';
import { contrastRatio, OPTION_COLORS, readableTextOn } from '../src/lib/colors';
import { msUntilNextUtcDay } from '../src/lib/useToday';

describe('readableTextOn', () => {
  it('meets WCAG AA (4.5:1) on every status color', () => {
    for (const [name, bg] of Object.entries(OPTION_COLORS)) {
      const ratio = contrastRatio(bg, readableTextOn(bg));
      expect(ratio, name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('computes known ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(readableTextOn('#ffffff')).toBe('#000000');
    expect(readableTextOn('#000000')).toBe('#ffffff');
  });
});

describe('msUntilNextUtcDay', () => {
  it('counts down to the next UTC midnight', () => {
    expect(msUntilNextUtcDay(Date.parse('2026-09-23T23:59:00Z'))).toBe(60_000);
    expect(msUntilNextUtcDay(Date.parse('2026-09-24T00:00:00Z'))).toBe(86_400_000);
  });
});
