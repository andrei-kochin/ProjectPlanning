/** Projects v2 single-select option colors mapped to GitHub Primer hues. */
const OPTION_COLORS: Record<string, string> = {
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

/** Readable text color for a GitHub label background (hex without '#'). */
export function labelTextColor(hex: string): string {
  const n = parseInt(hex, 16);
  if (Number.isNaN(n)) return '#1f2328';
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1f2328' : '#ffffff';
}
