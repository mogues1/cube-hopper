// Pixel-accurate sprite contact: two sprites touch when a drawn (non-transparent) pixel of
// one overlaps, or sits right next to (including diagonally), a drawn pixel of the other.

import { spriteOrigin } from './looks.ts';
import type { Look } from './looks.ts';
import type { Point } from './pyramid.ts';
import type { PixelSprite } from './sprites.ts';

/** A sprite as drawn: its look plus the anchor point it is drawn at. */
export interface Placed extends Look {
  readonly at: Point;
}

const maskCache = new Map<PixelSprite, { plain: boolean[][]; mirrored: boolean[][] }>();

/** Opaque-pixel mask, [y][x], for a sprite (mirrored or not). */
export function spriteMask(sprite: PixelSprite, mirrored: boolean): boolean[][] {
  let entry = maskCache.get(sprite);
  if (!entry) {
    const plain = sprite.rows.map((row) => [...row].map((ch) => ch !== '.'));
    entry = { plain, mirrored: plain.map((row) => [...row].reverse()) };
    maskCache.set(sprite, entry);
  }
  return mirrored ? entry.mirrored : entry.plain;
}

/** How close two drawn pixels may be and still count as touching (1 = adjacent). */
export const TOUCH_REACH = 1;

export function spritesTouch(a: Placed, b: Placed): boolean {
  const ao = spriteOrigin(a.sprite, a.at.x, a.at.y);
  const bo = spriteOrigin(b.sprite, b.at.x, b.at.y);
  const r = TOUCH_REACH;
  // Quick reject when the bounding boxes (grown by the reach) do not meet.
  if (
    ao.x > bo.x + b.sprite.width + r - 1 ||
    bo.x > ao.x + a.sprite.width + r - 1 ||
    ao.y > bo.y + b.sprite.height + r - 1 ||
    bo.y > ao.y + a.sprite.height + r - 1
  ) {
    return false;
  }
  const am = spriteMask(a.sprite, a.mirrored);
  const bm = spriteMask(b.sprite, b.mirrored);
  for (let ay = 0; ay < am.length; ay++) {
    const row = am[ay] ?? [];
    for (let ax = 0; ax < row.length; ax++) {
      if (!row[ax]) continue;
      // This pixel in b's coordinates.
      const bx = ao.x + ax - bo.x;
      const by = ao.y + ay - bo.y;
      for (let dy = -r; dy <= r; dy++) {
        const brow = bm[by + dy];
        if (!brow) continue;
        for (let dx = -r; dx <= r; dx++) if (brow[bx + dx]) return true;
      }
    }
  }
  return false;
}
