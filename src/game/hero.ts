import {
  FALL_FRAMES,
  FALL_GRAVITY,
  HOP_FRAMES,
  HOP_HEIGHT,
  INPUT_BUFFER_FRAMES,
  RESPAWN_DELAY_FRAMES,
} from './constants.ts';
import { APEX, cellToScreen, isBehindPyramid, isOnPyramid, step } from './pyramid.ts';
import type { Cell, Dir, Point } from './pyramid.ts';

export type HeroState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'hopping'; readonly from: Cell; readonly to: Cell; t: number }
  | { readonly kind: 'falling'; readonly at: Cell; readonly behind: boolean; t: number }
  | { readonly kind: 'respawning'; t: number };

export interface Hero {
  /** Last cell the hero stood on. */
  cell: Cell;
  state: HeroState;
  facing: Dir;
  /** Most recent requested hop, kept for a few frames so early presses are not lost. */
  buffered: Dir | null;
  bufferAge: number;
}

export type HeroEvent = 'hopStart' | 'landed' | 'fellOff' | 'respawned';

export function createHero(): Hero {
  return { cell: APEX, state: { kind: 'idle' }, facing: 'downRight', buffered: null, bufferAge: 0 };
}

/**
 * Advance the hero by one simulation step. `input` is the direction requested this step
 * (a new press or a held key), or null. Mutates `hero` and returns what happened.
 */
export function updateHero(hero: Hero, input: Dir | null): HeroEvent[] {
  const events: HeroEvent[] = [];
  const canAct = hero.state.kind === 'idle' || hero.state.kind === 'hopping';

  if (!canAct) {
    hero.buffered = null;
  } else if (input !== null) {
    hero.buffered = input;
    hero.bufferAge = 0;
  } else if (hero.buffered !== null) {
    hero.bufferAge += 1;
    if (hero.bufferAge > INPUT_BUFFER_FRAMES) hero.buffered = null;
  }

  const s = hero.state;
  switch (s.kind) {
    case 'idle':
      break;
    case 'hopping':
      s.t += 1;
      if (s.t >= HOP_FRAMES) {
        if (isOnPyramid(s.to)) {
          hero.cell = s.to;
          hero.state = { kind: 'idle' };
          events.push('landed');
        } else {
          hero.state = { kind: 'falling', at: s.to, behind: isBehindPyramid(s.to), t: 0 };
          events.push('fellOff');
        }
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
  if (hero.state.kind === 'idle' && hero.buffered !== null && !events.includes('respawned')) {
    const dir = hero.buffered;
    hero.buffered = null;
    hero.facing = dir;
    hero.state = { kind: 'hopping', from: hero.cell, to: step(hero.cell, dir), t: 0 };
    events.push('hopStart');
  }

  return events;
}

export interface HeroPose extends Point {
  readonly visible: boolean;
  /** Draw before the pyramid (falling off a back edge). */
  readonly behind: boolean;
}

/** Where to draw the hero's feet this step. */
export function heroPose(hero: Hero): HeroPose {
  const s = hero.state;
  switch (s.kind) {
    case 'idle': {
      const p = cellToScreen(hero.cell);
      return { x: p.x, y: p.y, visible: true, behind: false };
    }
    case 'hopping': {
      const p = s.t / HOP_FRAMES;
      const a = cellToScreen(s.from);
      const b = cellToScreen(s.to);
      const lift = HOP_HEIGHT * 4 * p * (1 - p);
      return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p - lift, visible: true, behind: false };
    }
    case 'falling': {
      const base = cellToScreen(s.at);
      return { x: base.x, y: base.y + 0.5 * FALL_GRAVITY * s.t * s.t, visible: true, behind: s.behind };
    }
    case 'respawning':
      return { x: 0, y: 0, visible: false, behind: false };
  }
}
