const GREEN = '#16A34A';
const YELLOW = '#EAB308';
const RED = '#DC2626';
const DARK_RED = '#7F1D1D';

const RED_START_TOTAL = 500_000;
const MAX_TOTAL = 1_500_000;

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hexColor: string): RgbColor {
  const normalized = hexColor.replace('#', '');

  if (!/^[\dA-Fa-f]{6}$/.test(normalized)) {
    throw new Error(`Invalid color: ${hexColor}`);
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function toHexPart(channel: number): string {
  return Math.round(clamp(channel, 0, 255))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
}

function rgbToHex(color: RgbColor): string {
  return `#${toHexPart(color.r)}${toHexPart(color.g)}${toHexPart(color.b)}`;
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function interpolateColor(startHex: string, endHex: string, progress: number): string {
  const t = clamp(progress, 0, 1);
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);

  return rgbToHex({
    r: lerp(start.r, end.r, t),
    g: lerp(start.g, end.g, t),
    b: lerp(start.b, end.b, t),
  });
}

export function getChequeTextColor(total: number): string {
  const normalized = Number.isFinite(total) ? total : 0;

  if (normalized <= 0) {
    return GREEN;
  }

  const clampedTotal = clamp(normalized, 1, MAX_TOTAL);

  if (clampedTotal <= RED_START_TOTAL) {
    const progress = (clampedTotal - 1) / (RED_START_TOTAL - 1);
    return interpolateColor(YELLOW, RED, progress);
  }

  const progress = (clampedTotal - RED_START_TOTAL) / (MAX_TOTAL - RED_START_TOTAL);
  return interpolateColor(RED, DARK_RED, progress);
}
