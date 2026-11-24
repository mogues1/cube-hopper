// Pixel-exact cube rasterization, kept free of DOM APIs so it can be unit tested.

import { CUBE_SIDE_H, CUBE_TOP_H, CUBE_W } from './constants.ts';

export type CubeFace = 'none' | 'top' | 'left' | 'right';

/** Cube bitmap size: top diamond plus side faces. */
export const CUBE_BMP_W = CUBE_W;
export const CUBE_BMP_H = CUBE_TOP_H + CUBE_SIDE_H;

/**
 * Which face covers pixel (px, py) of a cube bitmap whose top-left corner is
 * (topCenterX - CUBE_W/2, topCenterY - CUBE_TOP_H/2). Tested at pixel centres.
 */
export function cubeFaceAt(px: number, py: number): CubeFace {
  const half = CUBE_W / 2; // 16
  const h = CUBE_TOP_H / 2; // 8
  const x = px + 0.5;
  const y = py + 0.5;
  if (x < 0 || x > CUBE_W || y < 0 || y > CUBE_BMP_H) return 'none';

  const dx = Math.abs(x - half) / half;
  // Top face: diamond centred at (half, h).
  if (dx + Math.abs(y - h) / h <= 1) return 'top';

  // Lower edge of the top diamond at this x, then the side face hangs CUBE_SIDE_H below it.
  const diamondBottom = h + (1 - dx) * h;
  if (y > diamondBottom && y <= diamondBottom + CUBE_SIDE_H) {
    // Upper edge of the side region is the diamond's outer corner line.
    if (y >= h) return x < half ? 'left' : 'right';
  }
  return 'none';
}
