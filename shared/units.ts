import { PLATE_HEIGHT_MM, STUD_PITCH_MM } from './constants';

export interface PlateDimensions {
  width: number;
  depth: number;
  height: number;
}

/** Turns a size in millimetres into studs (width, depth) and plates (height). */
export function millimetresToPlateUnits(
  widthMm: number,
  depthMm: number,
  heightMm: number,
): PlateDimensions {
  const toStuds = (mm: number) => Math.max(1, Math.round(mm / STUD_PITCH_MM));
  const toPlates = (mm: number) => Math.max(1, Math.round(mm / PLATE_HEIGHT_MM));
  return { width: toStuds(widthMm), depth: toStuds(depthMm), height: toPlates(heightMm) };
}

export function formatDimensions(w: number | null, d: number | null, h: number | null): string {
  if (w == null || d == null || h == null) return '';
  return `${w} x ${d} x ${h}`;
}
