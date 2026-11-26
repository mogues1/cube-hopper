// Shared movement curves for everything that hops, falls or drops in, in screen space.

import { FALL_GRAVITY, HOP_HEIGHT } from './constants.ts';
import { cellToScreen } from './pyramid.ts';
import type { Cell, Point } from './pyramid.ts';

/** Position along a hop from `from` to `to` at fraction `p` (0..1), arcing `height` px up. */
export function hopPoint(from: Cell, to: Cell, p: number, height = HOP_HEIGHT): Point {
  const a = cellToScreen(from);
  const b = cellToScreen(to);
  const lift = height * 4 * p * (1 - p);
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p - lift };
}

/** Position `t` frames into a fall from `at`, accelerating downward. */
export function fallPoint(at: Cell, t: number): Point {
  const base = cellToScreen(at);
  return { x: base.x, y: base.y + 0.5 * FALL_GRAVITY * t * t };
}

export function lerpPoint(a: Point, b: Point, p: number): Point {
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
}
