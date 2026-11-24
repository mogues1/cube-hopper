import { CUBE_TOP_H, CUBE_W, SCREEN_H, SCREEN_W } from './constants.ts';
import { CUBE_BMP_H, CUBE_BMP_W, cubeFaceAt } from './cube.ts';
import { heroPose } from './hero.ts';
import type { Hero } from './hero.ts';
import { PALETTE } from './palette.ts';
import { allCells, cellToScreen, isLeftward, isUpward } from './pyramid.ts';
import { PIP_BACK, PIP_FRONT } from './sprites.ts';
import type { PixelSprite } from './sprites.ts';

type Bitmap = HTMLCanvasElement;

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeBitmap(w: number, h: number, paint: (x: number, y: number) => string | null): Bitmap {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const color = paint(x, y);
      if (color === null) continue;
      const [r, g, b] = hexToRgb(color);
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

const cubeCache = new Map<string, Bitmap>();

function cubeBitmap(topColor: string): Bitmap {
  let bmp = cubeCache.get(topColor);
  if (!bmp) {
    bmp = makeBitmap(CUBE_BMP_W, CUBE_BMP_H, (x, y) => {
      switch (cubeFaceAt(x, y)) {
        case 'top':
          return topColor;
        case 'left':
          return x === CUBE_W / 2 - 1 ? PALETTE.cubeEdge : PALETTE.cubeLeft;
        case 'right':
          return PALETTE.cubeRight;
        case 'none':
          return null;
      }
    });
    cubeCache.set(topColor, bmp);
  }
  return bmp;
}

const spriteCache = new Map<string, Bitmap>();

function spriteBitmap(sprite: PixelSprite, mirrored: boolean): Bitmap {
  const key = `${sprite.rows.join('/')}|${mirrored}`;
  let bmp = spriteCache.get(key);
  if (!bmp) {
    bmp = makeBitmap(sprite.width, sprite.height, (x, y) => {
      const sx = mirrored ? sprite.width - 1 - x : x;
      const ch = sprite.rows[y]?.[sx] ?? '.';
      return ch === '.' ? null : (sprite.colors[ch] ?? null);
    });
    spriteCache.set(key, bmp);
  }
  return bmp;
}

function drawHero(ctx: CanvasRenderingContext2D, hero: Hero): void {
  const pose = heroPose(hero);
  if (!pose.visible) return;
  const sprite = isUpward(hero.facing) ? PIP_BACK : PIP_FRONT;
  const bmp = spriteBitmap(sprite, isLeftward(hero.facing));
  ctx.drawImage(bmp, Math.round(pose.x - sprite.anchorX), Math.round(pose.y - sprite.anchorY));
}

function drawPyramid(ctx: CanvasRenderingContext2D): void {
  // Row-major order: lower rows overlap the side faces of the rows above.
  const bmp = cubeBitmap(PALETTE.cubeTopStart);
  for (const cell of allCells()) {
    const p = cellToScreen(cell);
    ctx.drawImage(bmp, p.x - CUBE_W / 2, p.y - CUBE_TOP_H / 2);
  }
}

export function renderFrame(ctx: CanvasRenderingContext2D, hero: Hero): void {
  ctx.fillStyle = PALETTE.background;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  const behind = heroPose(hero).behind;
  if (behind) drawHero(ctx, hero);
  drawPyramid(ctx);
  if (!behind) drawHero(ctx, hero);
}
