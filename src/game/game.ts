// Game flow: level demo → playing → round-complete flash → next round. Pure state, no DOM.

import { colorAt, createBoard, isComplete, landOnCell, resetBoard } from './board.ts';
import type { Board } from './board.ts';
import {
  DEMO_END_FRAMES,
  DEMO_HOP_PAUSE_FRAMES,
  DEMO_START_FRAMES,
  ROUND_FLASH_FRAMES,
} from './constants.ts';
import { createHero, updateHero } from './hero.ts';
import type { Hero, HeroEvent } from './hero.ts';
import type { Cell, Dir } from './pyramid.ts';
import { FIRST_STAGE, nextStage, roundBonus, ruleForLevel } from './rules.ts';
import type { ColorRule, CubeColor, Stage } from './rules.ts';

/**
 * The demo at the start of each level: hop between the apex and the cube below-left of it,
 * three times each, so the player sees a cube go through every step of the level's rule,
 * including what hopping a finished cube does.
 */
export const DEMO_PATH: readonly Dir[] = [
  'downLeft',
  'upRight',
  'downLeft',
  'upRight',
  'downLeft',
  'upRight',
];

export type Phase =
  /** `t` counts frames since the demo started or the hero last landed. */
  | { readonly kind: 'demo'; hop: number; t: number }
  | { readonly kind: 'playing' }
  | { readonly kind: 'roundComplete'; readonly bonus: number; t: number };

export interface Game {
  stage: Stage;
  score: number;
  board: Board;
  hero: Hero;
  phase: Phase;
}

export type GameEvent =
  | { readonly kind: 'demoStart'; readonly level: number }
  | { readonly kind: 'roundStart'; readonly stage: Stage }
  | { readonly kind: 'cubeChanged'; readonly cell: Cell; readonly color: CubeColor; readonly points: number }
  | { readonly kind: 'roundComplete'; readonly stage: Stage; readonly bonus: number }
  | { readonly kind: 'hero'; readonly event: HeroEvent };

export function createGame(stage: Stage = FIRST_STAGE): Game {
  return {
    stage,
    score: 0,
    board: createBoard(),
    hero: createHero(),
    phase: { kind: 'demo', hop: 0, t: 0 },
  };
}

export function currentRule(game: Game): ColorRule {
  return ruleForLevel(game.stage.level);
}

function startDemo(game: Game, events: GameEvent[]): void {
  resetBoard(game.board);
  game.hero = createHero();
  game.phase = { kind: 'demo', hop: 0, t: 0 };
  events.push({ kind: 'demoStart', level: game.stage.level });
}

function startRound(game: Game, events: GameEvent[]): void {
  resetBoard(game.board);
  game.hero = createHero();
  game.phase = { kind: 'playing' };
  events.push({ kind: 'roundStart', stage: game.stage });
}

function heroEvents(events: GameEvent[], heroEvts: HeroEvent[]): void {
  for (const event of heroEvts) events.push({ kind: 'hero', event });
}

/**
 * Advance one simulation step. `pressed`/`held` are the player's input, ignored outside
 * the playing phase. Mutates `game` and returns what happened.
 */
export function updateGame(game: Game, pressed: Dir | null, held: Dir | null = null): GameEvent[] {
  const events: GameEvent[] = [];
  const phase = game.phase;
  const rule = currentRule(game);

  switch (phase.kind) {
    case 'demo': {
      const hero = game.hero;
      if (hero.state.kind === 'idle') {
        if (phase.hop < DEMO_PATH.length) {
          const wait = phase.hop === 0 ? DEMO_START_FRAMES : DEMO_HOP_PAUSE_FRAMES;
          if (phase.t >= wait) {
            heroEvents(events, updateHero(hero, DEMO_PATH[phase.hop] ?? null));
            phase.hop += 1;
          } else {
            phase.t += 1;
          }
        } else if (phase.t >= DEMO_END_FRAMES) {
          startRound(game, events);
        } else {
          phase.t += 1;
        }
      } else {
        // Demo hops recolor cubes but never score; the hero pauses after every landing.
        const evts = updateHero(hero, null, null, (cell) => {
          const before = colorAt(game.board, cell);
          const r = landOnCell(game.board, rule, cell);
          if (r.color !== before) events.push({ kind: 'cubeChanged', cell, color: r.color, points: 0 });
          phase.t = 0;
          return false;
        });
        heroEvents(events, evts);
      }
      break;
    }

    case 'playing': {
      const evts = updateHero(game.hero, pressed, held, (cell) => {
        const before = colorAt(game.board, cell);
        const r = landOnCell(game.board, rule, cell);
        game.score += r.points;
        if (r.color !== before) {
          events.push({ kind: 'cubeChanged', cell, color: r.color, points: r.points });
        }
        if (!isComplete(game.board)) return true;
        const bonus = roundBonus(game.stage);
        game.score += bonus;
        game.phase = { kind: 'roundComplete', bonus, t: 0 };
        events.push({ kind: 'roundComplete', stage: game.stage, bonus });
        return false;
      });
      heroEvents(events, evts);
      break;
    }

    case 'roundComplete': {
      phase.t += 1;
      if (phase.t >= ROUND_FLASH_FRAMES) {
        const prevLevel = game.stage.level;
        game.stage = nextStage(game.stage);
        if (game.stage.level !== prevLevel) startDemo(game, events);
        else startRound(game, events);
      }
      break;
    }
  }

  return events;
}
