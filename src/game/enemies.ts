// Hazard balls, the egg and the Chaser: movement, pursuit AI and collision cells. No DOM.

import {
  BALL_PAUSE_FRAMES,
  CHASER_PAUSE_FRAMES,
  EGG_HATCH_FRAMES,
  ENEMY_DROP_FRAMES,
  ENEMY_DROP_HEIGHT,
  FALL_FRAMES,
  HOP_FRAMES,
  ROWS,
} from './constants.ts';
import { fallPoint, hopPoint, lerpPoint } from './motion.ts';
import { allCells, cellIndex, cellToScreen, DIRS, isBehindPyramid, isOnPyramid, step } from './pyramid.ts';
import type { Cell, Dir, Point } from './pyramid.ts';
import type { Rng } from './rng.ts';

export type EnemyKind = 'ball' | 'egg' | 'chaser';

export type EnemyState =
  /** Falling in from above the screen onto `to` (a row-1 cube). */
  | { readonly kind: 'dropping'; readonly to: Cell; t: number }
  /** Standing on its cube between hops. */
  | { readonly kind: 'resting'; t: number }
  | { readonly kind: 'hopping'; readonly from: Cell; readonly to: Cell; t: number }
  | { readonly kind: 'falling'; readonly at: Cell; readonly behind: boolean; t: number };

export interface Enemy {
  readonly id: number;
  kind: EnemyKind;
  /** Last cube it stood on (its drop target while dropping). */
  cell: Cell;
  state: EnemyState;
  facing: Dir;
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
  /** The cube the Chaser heads for, or null if the hero is not on the pyramid. */
  readonly target: Cell | null;
  readonly lure: Lure | null;
}

export type EnemyEvent = 'landed' | 'hatched' | 'fellOff' | 'lured' | 'gone';

/** The two cubes under the apex, where every enemy drops in. */
export const DROP_CELLS: readonly Cell[] = [
  { row: 1, col: 0 },
  { row: 1, col: 1 },
];

export function createEnemy(id: number, kind: 'ball' | 'egg', to: Cell): Enemy {
  return { id, kind, cell: to, state: { kind: 'dropping', to, t: 0 }, facing: 'downLeft', lured: false };
}

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

function pauseFrames(kind: EnemyKind): number {
  return kind === 'ball' ? BALL_PAUSE_FRAMES : CHASER_PAUSE_FRAMES;
}

function nextDir(enemy: Enemy, ctx: EnemyContext): Dir | null {
  if (enemy.kind !== 'chaser') return ctx.rng.int(2) === 0 ? 'downLeft' : 'downRight';
  const lure = ctx.lure;
  if (lure && enemy.cell.row === lure.cell.row && enemy.cell.col === lure.cell.col) return lure.dir;
  const target = lure ? lure.cell : ctx.target;
  return target ? chaseDir(enemy.cell, target) : null;
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
      if (enemy.kind === 'egg' && enemy.cell.row === ROWS - 1) {
        if (s.t >= EGG_HATCH_FRAMES) {
          enemy.kind = 'chaser';
          enemy.state = { kind: 'resting', t: 0 };
          events.push('hatched');
        }
        break;
      }
      if (s.t < pauseFrames(enemy.kind)) break;
      const dir = nextDir(enemy, ctx);
      if (dir === null) break; // Chaser with nothing to chase waits.
      enemy.facing = dir;
      enemy.state = { kind: 'hopping', from: enemy.cell, to: step(enemy.cell, dir), t: 0 };
      break;
    }
    case 'hopping':
      s.t += 1;
      if (s.t >= HOP_FRAMES) {
        if (isOnPyramid(s.to)) {
          enemy.cell = s.to;
          enemy.state = { kind: 'resting', t: 0 };
          events.push('landed');
        } else {
          enemy.state = { kind: 'falling', at: s.to, behind: isBehindPyramid(s.to), t: 0 };
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
    case 'hopping':
      if (s.t < HOP_FRAMES / 2) return s.from;
      return isOnPyramid(s.to) ? s.to : null;
    default:
      return null;
  }
}

export interface EnemyPose extends Point {
  readonly behind: boolean;
}

export function enemyPose(enemy: Enemy): EnemyPose {
  const s = enemy.state;
  switch (s.kind) {
    case 'dropping': {
      const land = cellToScreen(s.to);
      const p = s.t / ENEMY_DROP_FRAMES;
      return { ...lerpPoint({ x: land.x, y: land.y - ENEMY_DROP_HEIGHT }, land, p * p), behind: false };
    }
    case 'resting':
      return { ...cellToScreen(enemy.cell), behind: false };
    case 'hopping':
      return { ...hopPoint(s.from, s.to, s.t / HOP_FRAMES), behind: false };
    case 'falling':
      return { ...fallPoint(s.at, s.t), behind: s.behind };
  }
}
