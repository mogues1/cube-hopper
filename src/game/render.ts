import { colorAt } from './board.ts';
import {
  CUBE_TOP_H,
  CUBE_W,
  GAME_OVER_MIN_FRAMES,
  ROUND_FLASH_PERIOD,
  SCREEN_H,
  SCREEN_W,
} from './constants.ts';
import { CUBE_BMP_H, CUBE_BMP_W, cubeFaceAt } from './cube.ts';
import { GLYPH_H, rasterizeText, textWidth } from './font.ts';
import { currentRule } from './game.ts';
import type { Game } from './game.ts';
import { enemyPose } from './enemies.ts';
import type { Enemy } from './enemies.ts';
import { heroPose, padRidePoint } from './hero.ts';
import type { Hero } from './hero.ts';
import { PALETTE } from './palette.ts';
import { allCells, cellToScreen, isLeftward, isUpward } from './pyramid.ts';
import type { Point } from './pyramid.ts';
import { DESTINATION, INTERMEDIATE, START } from './rules.ts';
import type { CubeColor } from './rules.ts';
import {
  CHASER,
  CHASER_EGG,
  HAZARD_BALL,
  LIFE_ICON,
  LIFT_PAD,
  LIFT_PAD_COLORS,
  PIP_BACK,
  PIP_FRONT,
} from './sprites.ts';
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
  const key = `${sprite.rows.join('/')}|${JSON.stringify(sprite.colors)}|${mirrored}`;
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

function drawSprite(ctx: CanvasRenderingContext2D, sprite: PixelSprite, at: Point, mirrored = false): void {
  const bmp = spriteBitmap(sprite, mirrored);
  ctx.drawImage(bmp, Math.round(at.x - sprite.anchorX), Math.round(at.y - sprite.anchorY));
}

/** Frames per lift-pad color step. */
const PAD_SPIN_FRAMES = 6;

function padSprite(frame: number): PixelSprite {
  const c = LIFT_PAD_COLORS[Math.floor(frame / PAD_SPIN_FRAMES) % LIFT_PAD_COLORS.length];
  return { ...LIFT_PAD, colors: { ...LIFT_PAD.colors, c: c ?? PALETTE.cubeTopIntermediate } };
}

/** Pip blinks while frozen after being caught. */
const DEATH_BLINK_FRAMES = 6;

function drawHero(ctx: CanvasRenderingContext2D, game: Game): void {
  const hero = game.hero;
  const pose = heroPose(hero);
  if (!pose.visible) return;
  const phase = game.phase;
  if (phase.kind === 'dying' && Math.floor(phase.t / DEATH_BLINK_FRAMES) % 2 === 1) return;
  const sprite = isUpward(hero.facing) ? PIP_BACK : PIP_FRONT;
  drawSprite(ctx, sprite, pose, isLeftward(hero.facing));
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
  const pose = enemyPose(enemy);
  const sprite = enemy.kind === 'ball' ? HAZARD_BALL : enemy.kind === 'egg' ? CHASER_EGG : CHASER;
  drawSprite(ctx, sprite, pose, enemy.kind === 'chaser' && isLeftward(enemy.facing));
}

/** Something drawn on top of the pyramid, sorted by screen y so lower things overlap higher ones. */
interface Drawable {
  readonly y: number;
  readonly behind: boolean;
  draw(): void;
}

function actors(ctx: CanvasRenderingContext2D, game: Game): Drawable[] {
  const list: Drawable[] = [];
  const hero = game.hero;
  const heroAt = heroPose(hero);
  // A pad carrying the hero is drawn just under the hero's feet.
  if (hero.state.kind === 'riding') {
    const padAt = padRidePoint(hero.state.pad, hero.state.t);
    list.push({ y: heroAt.y - 0.5, behind: false, draw: () => drawSprite(ctx, padSprite(game.frame), padAt) });
  }
  list.push({ y: heroAt.y, behind: heroAt.behind, draw: () => drawHero(ctx, game) });
  for (const enemy of game.enemies) {
    const at = enemyPose(enemy);
    list.push({ y: at.y, behind: at.behind, draw: () => drawEnemy(ctx, enemy) });
  }
  return list.sort((a, b) => a.y - b.y);
}

const TOP_COLORS: Readonly<Record<CubeColor, string>> = {
  [START]: PALETTE.cubeTopStart,
  [INTERMEDIATE]: PALETTE.cubeTopIntermediate,
  [DESTINATION]: PALETTE.cubeTopGoal,
};

const FLASH_CYCLE: readonly CubeColor[] = [DESTINATION, START, INTERMEDIATE];

function drawPyramid(ctx: CanvasRenderingContext2D, game: Game): void {
  const phase = game.phase;
  const flash =
    phase.kind === 'roundComplete'
      ? FLASH_CYCLE[Math.floor(phase.t / ROUND_FLASH_PERIOD) % FLASH_CYCLE.length]
      : undefined;
  // Row-major order: lower rows overlap the side faces of the rows above.
  for (const cell of allCells()) {
    const p = cellToScreen(cell);
    const bmp = cubeBitmap(TOP_COLORS[flash ?? colorAt(game.board, cell)]);
    ctx.drawImage(bmp, p.x - CUBE_W / 2, p.y - CUBE_TOP_H / 2);
  }
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, scale = 1): void {
  ctx.fillStyle = PALETTE.text;
  rasterizeText(text, 0, 0, (px, py) => ctx.fillRect(x + px * scale, y + py * scale, scale, scale));
}

function drawTextRight(ctx: CanvasRenderingContext2D, text: string, right: number, y: number): void {
  drawText(ctx, text, right - textWidth(text), y);
}

function drawTextCentered(ctx: CanvasRenderingContext2D, text: string, y: number, scale: number): void {
  drawText(ctx, text, Math.round((SCREEN_W - textWidth(text) * scale) / 2), y, scale);
}

const SWATCH_W = 7;
const SWATCH_H = GLYPH_H;

/** The color sequence the current level asks for, e.g. start > intermediate > goal. */
function drawGoal(ctx: CanvasRenderingContext2D, game: Game, x: number, y: number): void {
  drawText(ctx, 'GOAL', x, y);
  const steps: CubeColor[] = currentRule(game).usesIntermediate
    ? [START, INTERMEDIATE, DESTINATION]
    : [START, DESTINATION];
  let cx = x;
  const sy = y + GLYPH_H + 2;
  steps.forEach((c, i) => {
    if (i > 0) {
      drawText(ctx, '>', cx + 1, sy);
      cx += 5;
    }
    ctx.fillStyle = TOP_COLORS[c];
    ctx.fillRect(cx, sy, SWATCH_W, SWATCH_H);
    cx += SWATCH_W + 1;
  });
}

function drawLives(ctx: CanvasRenderingContext2D, game: Game, x: number, y: number): void {
  // Reserve lives only: the one in play is Pip on the pyramid.
  for (let i = 0; i < game.lives - 1; i++) drawSprite(ctx, LIFE_ICON, { x: x + i * (LIFE_ICON.width + 2), y });
}

function drawHud(ctx: CanvasRenderingContext2D, game: Game): void {
  drawText(ctx, 'SCORE', 4, 4);
  drawText(ctx, String(game.score), 4, 11);
  drawTextRight(ctx, `LEVEL ${game.stage.level}`, SCREEN_W - 4, 4);
  drawTextRight(ctx, `ROUND ${game.stage.round}`, SCREEN_W - 4, 11);
  drawGoal(ctx, game, 4, 20);
  drawLives(ctx, game, 4, 37);

  const phase = game.phase;
  const captionY = SCREEN_H - 20;
  if (phase.kind === 'demo') drawTextCentered(ctx, `LEVEL ${game.stage.level}`, captionY, 2);
  else if (phase.kind === 'roundComplete') drawTextCentered(ctx, `BONUS ${phase.bonus}`, captionY, 2);
  else if (phase.kind === 'gameOver') {
    drawTextCentered(ctx, 'GAME OVER', captionY - 8, 2);
    if (phase.t >= GAME_OVER_MIN_FRAMES) drawTextCentered(ctx, 'PRESS A KEY', captionY + 8, 1);
  }
}

export function renderFrame(ctx: CanvasRenderingContext2D, game: Game): void {
  ctx.fillStyle = PALETTE.background;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  const list = actors(ctx, game);
  for (const a of list) if (a.behind) a.draw();
  drawPyramid(ctx, game);
  const pad = padSprite(game.frame);
  for (const cell of game.pads) drawSprite(ctx, pad, cellToScreen(cell));
  for (const a of list) if (!a.behind) a.draw();
  drawHud(ctx, game);
}
