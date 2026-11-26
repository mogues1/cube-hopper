import {
  FALL_FRAMES,
  HOP_FRAMES,
  INPUT_BUFFER_FRAMES,
  LIFT_DROP_FRAMES,
  LIFT_HOVER_Y,
  LIFT_RIDE_FRAMES,
  RESPAWN_DELAY_FRAMES,
} from './constants.ts';
import { fallPoint, hopPoint, lerpPoint } from './motion.ts';
import { APEX, cellToScreen, isBehindPyramid, isOnPyramid, step } from './pyramid.ts';
import type { Cell, Dir, Point } from './pyramid.ts';

export type HeroState =
  | { readonly kind: 'idle' }
  /** `frames` is this hop's duration, fixed when it starts. */
  | { readonly kind: 'hopping'; readonly from: Cell; readonly to: Cell; readonly frames: number; t: number }
  /** Carried by a lift pad from `pad` (an off-pyramid cell) to the apex. */
  | { readonly kind: 'riding'; readonly pad: Cell; t: number }
  | { readonly kind: 'falling'; readonly at: Cell; readonly behind: boolean; t: number }
  | { readonly kind: 'respawning'; t: number };

export interface Hero {
  /** Last cell the hero stood on. */
  cell: Cell;
  state: HeroState;
  facing: Dir;
  /** Duration of the hero's hops (the level's speed). */
  hopFrames: number;
  /** Most recent requested hop, kept for a few frames so early presses are not lost. */
  buffered: Dir | null;
  bufferAge: number;
}

export type HeroEvent = 'hopStart' | 'landed' | 'boarded' | 'arrived' | 'fellOff' | 'respawned';

export interface HeroHooks {
  /**
   * Runs when the hero lands on a cube (including the apex after a lift-pad ride). Returning
   * false holds the hero in place: no follow-on hop this step and the buffer is cleared,
   * e.g. when that landing completes the round.
   */
  onLanded?(cell: Cell): boolean;
  /** True if a lift pad waits at this off-pyramid cell; the hero boards it instead of falling. */
  isPad?(cell: Cell): boolean;
}

export const RIDE_TOTAL_FRAMES = LIFT_RIDE_FRAMES + LIFT_DROP_FRAMES;

export function createHero(hopFrames: number = HOP_FRAMES): Hero {
  return { cell: APEX, state: { kind: 'idle' }, facing: 'downRight', hopFrames, buffered: null, bufferAge: 0 };
}

/**
 * Advance the hero by one simulation step. `pressed` is a fresh key press this step (it is
 * buffered briefly so early presses are not lost); `held` is a key still held down, which
 * only counts at the moment the hero is ready to hop, so a long tap never hops twice.
 * Mutates `hero` and returns what happened.
 */
export function updateHero(
  hero: Hero,
  pressed: Dir | null,
  held: Dir | null = null,
  hooks: HeroHooks = {},
): HeroEvent[] {
  let hold = false;
  const events: HeroEvent[] = [];
  const canAct = hero.state.kind === 'idle' || hero.state.kind === 'hopping';

  if (!canAct) {
    hero.buffered = null;
  } else if (pressed !== null) {
    hero.buffered = pressed;
    hero.bufferAge = 0;
  } else if (hero.buffered !== null) {
    hero.bufferAge += 1;
    if (hero.bufferAge > INPUT_BUFFER_FRAMES) hero.buffered = null;
  }

  const land = (cell: Cell): void => {
    hero.cell = cell;
    hero.state = { kind: 'idle' };
    events.push('landed');
    if (hooks.onLanded && !hooks.onLanded(cell)) hold = true;
  };

  const s = hero.state;
  switch (s.kind) {
    case 'idle':
      break;
    case 'hopping':
      s.t += 1;
      if (s.t >= s.frames) {
        if (isOnPyramid(s.to)) {
          land(s.to);
        } else if (hooks.isPad?.(s.to)) {
          hero.state = { kind: 'riding', pad: s.to, t: 0 };
          hero.buffered = null;
          events.push('boarded');
        } else {
          hero.state = { kind: 'falling', at: s.to, behind: isBehindPyramid(s.to), t: 0 };
          events.push('fellOff');
        }
      }
      break;
    case 'riding':
      s.t += 1;
      if (s.t >= RIDE_TOTAL_FRAMES) {
        hero.facing = 'downRight';
        events.push('arrived');
        land(APEX);
      }
      break;
    case 'falling':
      s.t += 1;
      if (s.t >= FALL_FRAMES) hero.state = { kind: 'respawning', t: 0 };
      break;
    case 'respawning':
      s.t += 1;
      if (s.t >= RESPAWN_DELAY_FRAMES) {
        hero.cell = APEX;
        hero.facing = 'downRight';
        hero.state = { kind: 'idle' };
        events.push('respawned');
      }
      break;
  }

  // Start a new hop the same step the hero becomes idle, so held keys hop continuously.
  if (hold) {
    hero.buffered = null;
    return events;
  }
  const next = hero.buffered ?? held;
  if (hero.state.kind === 'idle' && next !== null && !events.includes('respawned')) {
    const dir = next;
    hero.buffered = null;
    hero.facing = dir;
    hero.state = { kind: 'hopping', from: hero.cell, to: step(hero.cell, dir), frames: hero.hopFrames, t: 0 };
    events.push('hopStart');
  }

  return events;
}

/**
 * The cube the hero counts as standing on for collisions: the start cube for the first half
 * of a hop and the target for the second half. Null when not on the pyramid.
 */
export function heroOccupies(hero: Hero): Cell | null {
  const s = hero.state;
  switch (s.kind) {
    case 'idle':
      return hero.cell;
    case 'hopping':
      if (s.t < s.frames / 2) return s.from;
      return isOnPyramid(s.to) ? s.to : null;
    default:
      return null;
  }
}

export interface HeroPose extends Point {
  readonly visible: boolean;
  /** Draw before the pyramid (falling off a back edge). */
  readonly behind: boolean;
}

/** Screen point where a lift pad ride ends, above the apex. */
export function rideTopPoint(): Point {
  const apex = cellToScreen(APEX);
  return { x: apex.x, y: apex.y - LIFT_HOVER_Y };
}

/** Where a pad carrying the hero is, `t` frames into the ride (the pad stays at the top for the drop). */
export function padRidePoint(pad: Cell, t: number): Point {
  return lerpPoint(cellToScreen(pad), rideTopPoint(), Math.min(t / LIFT_RIDE_FRAMES, 1));
}

/** Where to draw the hero's feet this step. */
export function heroPose(hero: Hero): HeroPose {
  const s = hero.state;
  switch (s.kind) {
    case 'idle': {
      const p = cellToScreen(hero.cell);
      return { x: p.x, y: p.y, visible: true, behind: false };
    }
    case 'hopping':
      return { ...hopPoint(s.from, s.to, s.t / s.frames), visible: true, behind: false };
    case 'riding': {
      if (s.t < LIFT_RIDE_FRAMES) return { ...padRidePoint(s.pad, s.t), visible: true, behind: false };
      const p = (s.t - LIFT_RIDE_FRAMES) / LIFT_DROP_FRAMES;
      return { ...lerpPoint(rideTopPoint(), cellToScreen(APEX), p * p), visible: true, behind: false };
    }
    case 'falling':
      return { ...fallPoint(s.at, s.t), visible: true, behind: s.behind };
    case 'respawning':
      return { x: 0, y: 0, visible: false, behind: false };
  }
}
