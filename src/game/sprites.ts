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

/** Hazard ball: glossy crimson sphere with one highlight. */
export const HAZARD_BALL: PixelSprite = {
  width: 10,
  height: 10,
  anchorX: 5,
  anchorY: 9,
  colors: { r: PALETTE.hazardRed, w: PALETTE.pipEyeWhite, k: PALETTE.cubeEdge },
  rows: [
    '...rrrr...',
    '.rrrrrrrr.',
    '.rwwrrrrr.',
    'rrwrrrrrrr',
    'rrrrrrrrrr',
    'rrrrrrrrrr',
    'rrrrrrrrrr',
    '.rrrrrrrr.',
    '.krrrrrrk.',
    '...kkkk...',
  ],
};

/** The Chaser's egg: speckled violet oval. */
export const CHASER_EGG: PixelSprite = {
  width: 10,
  height: 12,
  anchorX: 5,
  anchorY: 11,
  colors: { v: PALETTE.chaserViolet, w: PALETTE.pipEyeWhite, k: PALETTE.cubeEdge },
  rows: [
    '...vvvv...',
    '..vvvvvv..',
    '.vvwvvvvv.',
    '.vvvvvwvv.',
    'vvvvvvvvvv',
    'vwvvvvvvvv',
    'vvvvvwvvvv',
    'vvvvvvvvwv',
    'vvwvvvvvvv',
    '.vvvvvvvv.',
    '.kvvvvvvk.',
    '...kkkk...',
  ],
};

/** The Chaser: lanky violet lizard with a big eye and a curled tail, facing right. */
export const CHASER: PixelSprite = {
  width: 16,
  height: 16,
  anchorX: 8,
  anchorY: 15,
  colors: { v: PALETTE.chaserViolet, w: PALETTE.pipEyeWhite, k: PALETTE.cubeEdge, f: PALETTE.pipFeet },
  rows: [
    '................',
    '.....kkkkk......',
    '....kvvvvvk.....',
    '...kvvwwwvvk....',
    '...kvvwkkwvk....',
    '...kvvvwwvvvkkk.',
    '....kvvvvvvvvvk.',
    '.....kvvvvkkkk..',
    '......kvvk......',
    '.....kvvvvk.....',
    '....kvvvvvvk.kk.',
    '....kvvvvvvkkvvk',
    '.....kvvvvk.kvk.',
    '.....kvvvvkkvk..',
    '......kvvk.kk...',
    '.....ff..ff.....',
  ],
};

/** Colors a lift pad cycles through to look like it is spinning. */
export const LIFT_PAD_COLORS: readonly string[] = [
  PALETTE.cubeTopIntermediate,
  PALETTE.cubeTopGoal,
  PALETTE.pipFeet,
  PALETTE.pipSprout,
];

/** Lift pad: a flat hexagonal disc; `c` is its current cycle color. */
export const LIFT_PAD: PixelSprite = {
  width: 14,
  height: 6,
  anchorX: 7,
  anchorY: 1,
  colors: { c: PALETTE.cubeTopIntermediate, w: PALETTE.pipEyeWhite, k: PALETTE.cubeEdge },
  rows: [
    '...cccccccc...',
    '.cccwwwwwwccc.',
    'cccccccccccccc',
    'cccccccccccccc',
    '.kcccccccccck.',
    '...kkkkkkkk...',
  ],
};

/** Small Pip head for the lives display. */
export const LIFE_ICON: PixelSprite = {
  width: 7,
  height: 7,
  anchorX: 0,
  anchorY: 0,
  colors: PIP_COLORS,
  rows: ['...g...', '.bbbbb.', 'bbwwbbb', 'bbwkbbb', 'bbbbbbb', '.bbbbb.', '.f...f.'],
};

export const ALL_SPRITES: Readonly<Record<string, PixelSprite>> = {
  PIP_FRONT,
  PIP_BACK,
  HAZARD_BALL,
  CHASER_EGG,
  CHASER,
  LIFT_PAD,
  LIFE_ICON,
};
