// Which sprite each actor is drawn with, and whether it is mirrored. Shared by the renderer
// and by collision detection, so what you see is exactly what collides.

import type { Enemy } from './enemies.ts';
import type { Hero } from './hero.ts';
import { isLeftward, isUpward } from './pyramid.ts';
import {
  CHASER,
  CHASER_EGG,
  CRAWLER,
  FREEZE_ORB,
  HAZARD_BALL,
  PIP_BACK,
  PIP_FRONT,
  UNDOER,
} from './sprites.ts';
import type { PixelSprite } from './sprites.ts';

export interface Look {
  readonly sprite: PixelSprite;
  readonly mirrored: boolean;
}

const ENEMY_SPRITES: Readonly<Record<Enemy['kind'], PixelSprite>> = {
  ball: HAZARD_BALL,
  egg: CHASER_EGG,
  chaser: CHASER,
  freezeOrb: FREEZE_ORB,
  undoer: UNDOER,
  crawler: CRAWLER,
};

export function heroLook(hero: Hero): Look {
  return { sprite: isUpward(hero.facing) ? PIP_BACK : PIP_FRONT, mirrored: isLeftward(hero.facing) };
}

export function enemyLook(enemy: Enemy): Look {
  const mirrored =
    enemy.kind === 'crawler' ? enemy.side === 'right' : enemy.kind !== 'ball' && isLeftward(enemy.facing);
  return { sprite: ENEMY_SPRITES[enemy.kind], mirrored };
}

/** Top-left pixel where a sprite anchored at (x, y) is drawn. */
export function spriteOrigin(sprite: PixelSprite, x: number, y: number): { x: number; y: number } {
  return { x: Math.round(x - sprite.anchorX), y: Math.round(y - sprite.anchorY) };
}
