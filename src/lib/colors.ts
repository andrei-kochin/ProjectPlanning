/** Projects v2 single-select option colors mapped to GitHub Primer hues. */
export const OPTION_COLORS: Record<string, string> = {
  GRAY: '#8c959f',
  BLUE: '#2f81f7',
  GREEN: '#3fb950',
  YELLOW: '#d29922',
  ORANGE: '#db6d28',
  RED: '#f85149',
  PINK: '#db61a2',
  PURPLE: '#a371f7',
};

export function optionColor(color: string | null | undefined): string {
  return (color && OPTION_COLORS[color]) || OPTION_COLORS.GRAY;
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two #rrggbb colors. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever contrasts more with the #rrggbb background. */
export function readableTextOn(bg: string): string {
  return contrastRatio(bg, '#000000') >= contrastRatio(bg, '#ffffff') ? '#000000' : '#ffffff';
}

/** Readable text color for a GitHub label background (hex without '#'). */
export function labelTextColor(hex: string): string {
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#000000';
  return readableTextOn(`#${hex}`);
}
