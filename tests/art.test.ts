import { describe, expect, it } from 'vitest';
import { CUBE_BMP_H, CUBE_BMP_W, cubeFaceAt } from '../src/game/cube.ts';
import { PALETTE } from '../src/game/palette.ts';
import { PIP_BACK, PIP_FRONT } from '../src/game/sprites.ts';

describe('palette', () => {
  it('stays within 16 distinct colours', () => {
    expect(new Set(Object.values(PALETTE)).size).toBeLessThanOrEqual(16);
  });
});

describe('sprites', () => {
  for (const [name, sprite] of [
    ['PIP_FRONT', PIP_FRONT],
    ['PIP_BACK', PIP_BACK],
  ] as const) {
    it(`${name} rows match its declared size and use known colours`, () => {
      expect(sprite.rows).toHaveLength(sprite.height);
      for (const row of sprite.rows) {
        expect(row).toHaveLength(sprite.width);
        for (const ch of row) {
          if (ch !== '.') expect(sprite.colors[ch]).toBeTruthy();
        }
      }
    });
  }

  it('the back view has no eye', () => {
    expect(PIP_BACK.rows.join('')).not.toMatch(/[wk]/);
  });
});

describe('cube rasterizer', () => {
  const count = { top: 0, left: 0, right: 0, none: 0 };
  for (let y = 0; y < CUBE_BMP_H; y++) {
    for (let x = 0; x < CUBE_BMP_W; x++) count[cubeFaceAt(x, y)]++;
  }

  it('has a 32 x 32 bitmap', () => {
    expect(CUBE_BMP_W).toBe(32);
    expect(CUBE_BMP_H).toBe(32);
  });

  it('top diamond covers about half its 32 x 16 bounding box', () => {
    expect(count.top).toBeGreaterThan(240);
    expect(count.top).toBeLessThan(290);
  });

  it('left and right faces are mirror images', () => {
    expect(count.left).toBe(count.right);
    for (let y = 0; y < CUBE_BMP_H; y++) {
      for (let x = 0; x < 16; x++) {
        const a = cubeFaceAt(x, y);
        const b = cubeFaceAt(31 - x, y);
        if (a === 'left') expect(b).toBe('right');
      }
    }
  });

  it('has the expected silhouette points', () => {
    expect(cubeFaceAt(16, 0)).toBe('top');
    expect(cubeFaceAt(16, 8)).toBe('top');
    expect(cubeFaceAt(0, 0)).toBe('none');
    expect(cubeFaceAt(2, 16)).toBe('left');
    expect(cubeFaceAt(29, 16)).toBe('right');
    expect(cubeFaceAt(16, 31)).toBe('right');
    expect(cubeFaceAt(0, 31)).toBe('none');
  });
});
