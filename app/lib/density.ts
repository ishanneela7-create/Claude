import type { Density } from '../store/uiStore';

export const ROW_HEIGHT: Record<Density, number> = { compact: 34, normal: 46, comfortable: 64 };
export const THUMB_SIZE: Record<Density, number> = { compact: 22, normal: 32, comfortable: 48 };
export const CARD_SIZE: Record<Density, { width: number; height: number; image: number }> = {
  compact: { width: 132, height: 156, image: 56 },
  normal: { width: 176, height: 200, image: 84 },
  comfortable: { width: 224, height: 252, image: 120 },
};
export const HEADER_HEIGHT = 38;
export const GRID_GAP = 10;
