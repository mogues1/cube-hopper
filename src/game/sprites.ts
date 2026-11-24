// Pixel-art sprites as character grids. All art is original (see docs/IP.md).
// Each character maps to a palette entry; '.' is transparent.

import { PALETTE } from './palette.ts';

export interface PixelSprite {
  readonly width: number;
  readonly height: number;
  readonly rows: readonly string[];
  readonly colors: Readonly<Record<string, string>>;
  /** Pixel inside the sprite that sits on the ground point. */
  readonly anchorX: number;
  readonly anchorY: number;
}

const PIP_COLORS = {
  o: PALETTE.pipOutline,
  b: PALETTE.pipBody,
  h: PALETTE.pipHighlight,
  w: PALETTE.pipEyeWhite,
  k: PALETTE.pipOutline,
  f: PALETTE.pipFeet,
  g: PALETTE.pipSprout,
} as const;

/** Pip facing right, eye visible (used for downward hops; mirrored for left). */
export const PIP_FRONT: PixelSprite = {
  width: 16,
  height: 16,
  anchorX: 8,
  anchorY: 15,
  colors: PIP_COLORS,
  rows: [
    '......gg........',
    '.......g........',
    '.....oooooo.....',
    '...oobbbbbboo...',
    '..obhhbbbbbbbo..',
    '..obhbbwwwwbbo..',
    '.obbbbwwwkkwbbo.',
    '.obbbbwwwkkwbbo.',
    '.obbbbbwwwwbbbo.',
    '.obbbbbbbbbbbbo.',
    '..obbbbbbbbbbo..',
    '..obbbbbbbbbbo..',
    '...oobbbbbboo...',
    '.....oooooo.....',
    '....ff....ff....',
    '...fff...fff....',
  ],
};

/** Pip seen from behind (used for upward hops). */
export const PIP_BACK: PixelSprite = {
  ...PIP_FRONT,
  rows: PIP_FRONT.rows.map((r) => r.replace(/[wk]/g, 'b')),
};
