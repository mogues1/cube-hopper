import { describe, expect, it } from 'vitest';
import { CUBE_BMP_H, CUBE_BMP_W, cubeFaceAt } from '../src/game/cube.ts';
import { FONT, GLYPH_H, GLYPH_W, rasterizeText, textWidth } from '../src/game/font.ts';
import { PALETTE } from '../src/game/palette.ts';
import { ALL_SPRITES, LIFT_PAD_COLORS, PIP_BACK } from '../src/game/sprites.ts';

describe('palette', () => {
  it('stays within 16 distinct colours', () => {
    expect(new Set(Object.values(PALETTE)).size).toBeLessThanOrEqual(16);
  });
});

describe('sprites', () => {
  for (const [name, sprite] of Object.entries(ALL_SPRITES)) {
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

  it('sprite and pad colors all come from the palette', () => {
    const palette = new Set<string>(Object.values(PALETTE));
    for (const [name, sprite] of Object.entries(ALL_SPRITES)) {
      for (const c of Object.values(sprite.colors)) expect(palette.has(c), name).toBe(true);
    }
    for (const c of LIFT_PAD_COLORS) expect(palette.has(c)).toBe(true);
  });

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

describe('HUD font', () => {
  it('every glyph is 3 × 5 and uses only ink and blank', () => {
    for (const [ch, rows] of Object.entries(FONT)) {
      expect(rows, ch).toHaveLength(GLYPH_H);
      for (const row of rows) expect(row, ch).toMatch(new RegExp(`^[#.]{${GLYPH_W}}$`));
    }
  });

  it('covers digits, letters and HUD punctuation', () => {
    for (const ch of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ >-:!') expect(FONT[ch], ch).toBeDefined();
  });

  it('digit glyphs are all distinct', () => {
    const digits = '0123456789'.split('').map((d) => FONT[d]?.join('/'));
    expect(new Set(digits).size).toBe(10);
  });

  it('rasterizes inside the measured width, case-insensitively', () => {
    const pts: [number, number][] = [];
    rasterizeText('Lv 9', 10, 20, (x, y) => pts.push([x, y]));
    expect(pts.length).toBeGreaterThan(0);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(10);
      expect(x).toBeLessThan(10 + textWidth('Lv 9'));
      expect(y).toBeGreaterThanOrEqual(20);
      expect(y).toBeLessThan(20 + GLYPH_H);
    }
    const upper: [number, number][] = [];
    rasterizeText('LV 9', 10, 20, (x, y) => upper.push([x, y]));
    expect(pts).toEqual(upper);
    expect(textWidth('')).toBe(0);
  });
});

