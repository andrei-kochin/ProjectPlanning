import { describe, expect, it } from 'vitest';
import { contrastRatio, labelTextColor, OPTION_COLORS, readableTextOn } from '../src/lib/colors';
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

describe('labelTextColor', () => {
  it('meets WCAG AA for any label color, including mid-grays', () => {
    expect(labelTextColor('777777')).toBe('#000000');
    for (let v = 0; v <= 0xffffff; v += 0x0f0f0f / 3) {
      const hex = Math.floor(v).toString(16).padStart(6, '0');
      expect(contrastRatio(`#${hex}`, labelTextColor(hex)), hex).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('falls back to black for invalid input', () => {
    expect(labelTextColor('nope')).toBe('#000000');
  });
});

describe('msUntilNextUtcDay', () => {
  it('counts down to the next UTC midnight', () => {
    expect(msUntilNextUtcDay(Date.parse('2026-09-23T23:59:00Z'))).toBe(60_000);
    expect(msUntilNextUtcDay(Date.parse('2026-09-24T00:00:00Z'))).toBe(86_400_000);
  });
});
