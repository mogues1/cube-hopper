import { describe, expect, it } from 'vitest';
import { spriteMask, spritesTouch, TOUCH_REACH } from '../src/game/collide.ts';
import type { Placed } from '../src/game/collide.ts';
import { createCrawler } from '../src/game/enemies.ts';
import { createHero } from '../src/game/hero.ts';
import { enemyLook, heroLook } from '../src/game/looks.ts';
import { CHASER, HAZARD_BALL } from '../src/game/sprites.ts';
import type { PixelSprite } from '../src/game/sprites.ts';

/** A 3 × 3 sprite with only its centre pixel drawn, anchored on that pixel. */
const DOT: PixelSprite = { width: 3, height: 3, anchorX: 1, anchorY: 1, colors: { x: '#ffffff' }, rows: ['...', '.x.', '...'] };

const at = (sprite: PixelSprite, x: number, y: number, mirrored = false): Placed => ({ sprite, mirrored, at: { x, y } });

describe('pixel contact', () => {
  it('overlapping and adjacent drawn pixels touch; a 1-pixel gap does not', () => {
    expect(TOUCH_REACH).toBe(1);
    expect(spritesTouch(at(DOT, 10, 10), at(DOT, 10, 10))).toBe(true); // same pixel
    expect(spritesTouch(at(DOT, 10, 10), at(DOT, 11, 10))).toBe(true); // side by side
    expect(spritesTouch(at(DOT, 10, 10), at(DOT, 11, 11))).toBe(true); // diagonal neighbours
    expect(spritesTouch(at(DOT, 10, 10), at(DOT, 12, 10))).toBe(false); // one blank pixel between
    expect(spritesTouch(at(DOT, 10, 10), at(DOT, 10, 12))).toBe(false);
  });

  it('transparent corners of overlapping boxes do not count', () => {
    // Two balls whose bounding boxes share one corner pixel, blank in both sprites.
    const w = HAZARD_BALL.width;
    const h = HAZARD_BALL.height;
    expect(spritesTouch(at(HAZARD_BALL, 50, 50), at(HAZARD_BALL, 50 + w - 1, 50 + h - 1))).toBe(false);
    // Edge to edge along the middle row they do touch.
    expect(spritesTouch(at(HAZARD_BALL, 50, 50), at(HAZARD_BALL, 50 + w, 50))).toBe(true);
  });

  it('is symmetric and respects mirroring', () => {
    const cases: [Placed, Placed][] = [
      [at(CHASER, 40, 40), at(HAZARD_BALL, 52, 36)],
      [at(CHASER, 40, 40, true), at(HAZARD_BALL, 52, 36)],
      [at(CHASER, 40, 40), at(HAZARD_BALL, 30, 40)],
    ];
    for (const [a, b] of cases) expect(spritesTouch(a, b)).toBe(spritesTouch(b, a));
    const mask = spriteMask(CHASER, false);
    const mirror = spriteMask(CHASER, true);
    for (let y = 0; y < CHASER.height; y++) {
      for (let x = 0; x < CHASER.width; x++) expect(mirror[y]?.[x]).toBe(mask[y]?.[CHASER.width - 1 - x]);
    }
  });

  it('a crawler on the side of Pip’s cube reaches Pip’s feet', () => {
    const hero = createHero();
    hero.cell = { row: 4, col: 2 };
    for (const side of ['left', 'right'] as const) {
      const crawler = createCrawler(1, side, 18);
      crawler.cell = { row: 4, col: 2 };
      crawler.state = { kind: 'resting', t: 0 };
      // Same poses the game uses: Pip's feet on the cube top, the crawler on the face's top rim.
      const pip: Placed = { ...heroLook(hero), at: { x: 128, y: 136 } };
      const bug: Placed = { ...enemyLook(crawler), at: { x: 128 + (side === 'left' ? -8 : 8), y: 141 } };
      expect(spritesTouch(pip, bug), side).toBe(true);
    }
  });
});
