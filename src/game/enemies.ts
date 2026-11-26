// Every enemy: movement, the Chaser's pursuit AI and collision cells. No DOM.
//
// Bouncers (hazard ball, freeze orb, Undoer, egg) drop in onto row 1 and hop down at random.
// The egg hatches on the bottom row into the Chaser. Side crawlers walk along the cubes'
// side faces from a bottom corner toward the far edge.

import type { LevelSpeed } from './config.ts';
import { ENEMY_DROP_FRAMES, ENEMY_DROP_HEIGHT, FALL_FRAMES, FALL_GRAVITY, ROWS } from './constants.ts';
import { fallPoint, hopPoint, lerpPoint } from './motion.ts';
import type { Side } from './pads.ts';
import { allCells, cellIndex, cellToScreen, DIRS, isBehindPyramid, isOnPyramid, step } from './pyramid.ts';
import type { Cell, Dir, Point } from './pyramid.ts';
import type { Rng } from './rng.ts';

export type EnemyKind = 'ball' | 'egg' | 'chaser' | 'freezeOrb' | 'undoer' | 'crawler';
export type DropKind = 'ball' | 'egg' | 'freezeOrb' | 'undoer';

export type EnemyState =
  /** Falling in from above the screen onto `to` (a row-1 cube). */
  | { readonly kind: 'dropping'; readonly to: Cell; t: number }
  /** Standing on its cube between hops. */
  | { readonly kind: 'resting'; t: number }
  /** `frames` is this hop's duration, fixed when it starts. */
  | { readonly kind: 'hopping'; readonly from: Cell; readonly to: Cell; readonly frames: number; t: number }
  | { readonly kind: 'falling'; readonly at: Cell; readonly behind: boolean; t: number };

export interface Enemy {
  readonly id: number;
  kind: EnemyKind;
  /** Last cube it stood on (its drop target while dropping). For crawlers, the cube whose side it is on. */
  cell: Cell;
  state: EnemyState;
  facing: Dir;
  /** Crawlers only: which side faces it walks on (it enters at that side's bottom corner). */
  readonly side: Side | null;
  /** Set when a Chaser hops off the pyramid after the hero's lift pad. */
  lured: boolean;
}

/** Where the hero left the pyramid for a lift pad; the Chaser follows it off that edge. */
export interface Lure {
  readonly cell: Cell;
  readonly dir: Dir;
}

export interface EnemyContext {
  readonly rng: Rng;
  readonly speed: LevelSpeed;
  /** The cube the Chaser heads for, or null if the hero is not on the pyramid. */
  readonly target: Cell | null;
  readonly lure: Lure | null;
}

export type EnemyEvent = 'landed' | 'hatched' | 'fellOff' | 'lured' | 'gone';

/** The two cubes under the apex, where every dropping enemy lands. */
export const DROP_CELLS: readonly Cell[] = [
  { row: 1, col: 0 },
  { row: 1, col: 1 },
];

export function createEnemy(id: number, kind: DropKind, to: Cell): Enemy {
  return { id, kind, cell: to, state: { kind: 'dropping', to, t: 0 }, facing: 'downLeft', side: null, lured: false };
}

// --- Side crawlers --------------------------------------------------------------------------

/**
 * Crawler steps, as (row, col) changes of the cube whose face it is on. A left-face crawler
 * enters at the bottom-left corner and works right or up-right; a right-face crawler mirrors
 * it from the bottom-right. Either leaves the pyramid when it steps past the far edge.
 */
const CRAWLER_STEPS: Readonly<Record<Side, readonly { dr: number; dc: number }[]>> = {
  left: [
    { dr: 0, dc: 1 },
    { dr: -1, dc: 0 },
  ],
  right: [
    { dr: 0, dc: -1 },
    { dr: -1, dc: -1 },
  ],
};

const BOTTOM = ROWS - 1;

/** A crawler's first cube, and the off-pyramid cube it walks in from. */
export function crawlerEntry(side: Side): { from: Cell; to: Cell } {
  return side === 'left'
    ? { from: { row: BOTTOM, col: -1 }, to: { row: BOTTOM, col: 0 } }
    : { from: { row: BOTTOM, col: BOTTOM + 1 }, to: { row: BOTTOM, col: BOTTOM } };
}

export function createCrawler(id: number, side: Side, enemyHop: number): Enemy {
  const { from, to } = crawlerEntry(side);
  return {
    id,
    kind: 'crawler',
    cell: from,
    state: { kind: 'hopping', from, to, frames: enemyHop, t: 0 },
    facing: side === 'left' ? 'downRight' : 'downLeft',
    side,
    lured: false,
  };
}

/** Screen point of a crawler on the left or right side face of `cell`. */
export function facePoint(cell: Cell, side: Side): Point {
  const top = cellToScreen(cell);
  return { x: top.x + (side === 'left' ? -8 : 8), y: top.y + 14 };
}

// --- Chaser pursuit -------------------------------------------------------------------------

// All-pairs hop distances over the 28 cubes (BFS), for the Chaser's pursuit.
const CELLS = allCells();
const DIST: number[][] = CELLS.map((src) => {
  const dist = new Array<number>(CELLS.length).fill(Infinity);
  dist[cellIndex(src)] = 0;
  const queue: Cell[] = [src];
  for (let q = queue.shift(); q; q = queue.shift()) {
    const d = dist[cellIndex(q)] ?? Infinity;
    for (const dir of DIRS) {
      const n = step(q, dir);
      if (isOnPyramid(n) && (dist[cellIndex(n)] ?? Infinity) > d + 1) {
        dist[cellIndex(n)] = d + 1;
        queue.push(n);
      }
    }
  }
  return dist;
});

/** Hops between two cubes along the pyramid. */
export function hopDistance(a: Cell, b: Cell): number {
  return DIST[cellIndex(a)]?.[cellIndex(b)] ?? Infinity;
}

function screenDistance(a: Cell, b: Cell): number {
  const p = cellToScreen(a);
  const q = cellToScreen(b);
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/**
 * The Chaser's next hop: the neighbor cube fewest hops from the target, ties broken by
 * straight-line distance, then by DIRS order. Never hops off the pyramid on its own.
 */
export function chaseDir(from: Cell, target: Cell): Dir {
  let best: { dir: Dir; hops: number; dist: number } | null = null;
  for (const dir of DIRS) {
    const n = step(from, dir);
    if (!isOnPyramid(n)) continue;
    const hops = hopDistance(n, target);
    const dist = screenDistance(n, target);
    if (!best || hops < best.hops || (hops === best.hops && dist < best.dist)) best = { dir, hops, dist };
  }
  if (!best) throw new Error('no on-pyramid neighbor');
  return best.dir;
}

// --- Update ---------------------------------------------------------------------------------

function restFrames(kind: EnemyKind, speed: LevelSpeed): number {
  switch (kind) {
    case 'ball':
    case 'freezeOrb':
      return speed.ballRest;
    case 'undoer':
      return speed.undoerRest;
    case 'crawler':
      return speed.crawlerRest;
    case 'egg':
    case 'chaser':
      return speed.chaserRest;
  }
}

/** Where the enemy hops next, or null to keep waiting. */
function nextCell(enemy: Enemy, ctx: EnemyContext): Cell | null {
  if (enemy.kind === 'crawler') {
    const steps = CRAWLER_STEPS[enemy.side ?? 'left'];
    const d = steps[ctx.rng.int(steps.length)] ?? { dr: 0, dc: 1 };
    return { row: enemy.cell.row + d.dr, col: enemy.cell.col + d.dc };
  }
  if (enemy.kind !== 'chaser') {
    const dir: Dir = ctx.rng.int(2) === 0 ? 'downLeft' : 'downRight';
    enemy.facing = dir;
    return step(enemy.cell, dir);
  }
  const lure = ctx.lure;
  let dir: Dir | null;
  if (lure && enemy.cell.row === lure.cell.row && enemy.cell.col === lure.cell.col) dir = lure.dir;
  else {
    const target = lure ? lure.cell : ctx.target;
    dir = target ? chaseDir(enemy.cell, target) : null;
  }
  if (dir === null) return null; // nothing to chase: wait
  enemy.facing = dir;
  return step(enemy.cell, dir);
}

/** Advance one enemy by one step. Mutates it and returns what happened. */
export function updateEnemy(enemy: Enemy, ctx: EnemyContext): EnemyEvent[] {
  const events: EnemyEvent[] = [];
  const s = enemy.state;
  switch (s.kind) {
    case 'dropping':
      s.t += 1;
      if (s.t >= ENEMY_DROP_FRAMES) {
        enemy.cell = s.to;
        enemy.state = { kind: 'resting', t: 0 };
        events.push('landed');
      }
      break;
    case 'resting': {
      s.t += 1;
      if (enemy.kind === 'egg' && enemy.cell.row === BOTTOM) {
        if (s.t >= ctx.speed.eggHatch) {
          enemy.kind = 'chaser';
          enemy.state = { kind: 'resting', t: 0 };
          events.push('hatched');
        }
        break;
      }
      if (s.t < restFrames(enemy.kind, ctx.speed)) break;
      const to = nextCell(enemy, ctx);
      if (to === null) break;
      enemy.state = { kind: 'hopping', from: enemy.cell, to, frames: ctx.speed.enemyHop, t: 0 };
      break;
    }
    case 'hopping':
      s.t += 1;
      if (s.t >= s.frames) {
        if (isOnPyramid(s.to)) {
          enemy.cell = s.to;
          enemy.state = { kind: 'resting', t: 0 };
          events.push('landed');
        } else {
          enemy.state = { kind: 'falling', at: s.to, behind: isBehindPyramid(s.to) && enemy.kind !== 'crawler', t: 0 };
          events.push('fellOff');
          if (enemy.kind === 'chaser' && ctx.lure) {
            enemy.lured = true;
            events.push('lured');
          }
        }
      }
      break;
    case 'falling':
      s.t += 1;
      if (s.t >= FALL_FRAMES) events.push('gone');
      break;
  }
  return events;
}

/** The cube an enemy counts as standing on for collisions (same half-hop rule as the hero). */
export function enemyOccupies(enemy: Enemy): Cell | null {
  const s = enemy.state;
  switch (s.kind) {
    case 'resting':
      return enemy.cell;
    case 'hopping': {
      const c = s.t < s.frames / 2 ? s.from : s.to;
      return isOnPyramid(c) ? c : null;
    }
    default:
      return null;
  }
}

export interface EnemyPose extends Point {
  readonly behind: boolean;
}

/** Hop height for crawlers stepping along the faces (a scuttle, not a jump). */
const CRAWL_ARC = 4;

export function enemyPose(enemy: Enemy): EnemyPose {
  const s = enemy.state;
  const side = enemy.side;
  switch (s.kind) {
    case 'dropping': {
      const land = cellToScreen(s.to);
      const p = s.t / ENEMY_DROP_FRAMES;
      return { ...lerpPoint({ x: land.x, y: land.y - ENEMY_DROP_HEIGHT }, land, p * p), behind: false };
    }
    case 'resting':
      return { ...(side ? facePoint(enemy.cell, side) : cellToScreen(enemy.cell)), behind: false };
    case 'hopping': {
      const p = s.t / s.frames;
      if (!side) return { ...hopPoint(s.from, s.to, p), behind: false };
      const a = facePoint(s.from, side);
      const b = facePoint(s.to, side);
      const at = lerpPoint(a, b, p);
      return { x: at.x, y: at.y - CRAWL_ARC * 4 * p * (1 - p), behind: false };
    }
    case 'falling': {
      if (!side) return { ...fallPoint(s.at, s.t), behind: s.behind };
      const at = facePoint(s.at, side);
      return { x: at.x, y: at.y + 0.5 * FALL_GRAVITY * s.t * s.t, behind: false };
    }
  }
}
