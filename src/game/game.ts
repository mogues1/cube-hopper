// Game flow: level demo → playing (enemies, lift pads, deaths) → round-complete flash → next
// round, until the last life is lost → game over → new game. Pure state, no DOM.

import { colorAt, createBoard, isComplete, landOnCell, resetBoard } from './board.ts';
import type { Board } from './board.ts';
import {
  DEATH_FREEZE_FRAMES,
  DEMO_END_FRAMES,
  DEMO_HOP_PAUSE_FRAMES,
  DEMO_START_FRAMES,
  EXTRA_LIFE_EVERY,
  FIRST_EXTRA_LIFE,
  FIRST_SPAWN_FRAMES,
  GAME_OVER_MIN_FRAMES,
  HOP_FRAMES,
  MAX_HAZARD_BALLS,
  ROUND_FLASH_FRAMES,
  SPAWN_INTERVAL_FRAMES,
  START_LIVES,
} from './constants.ts';
import { createEnemy, DROP_CELLS, enemyOccupies, updateEnemy } from './enemies.ts';
import type { Enemy, Lure } from './enemies.ts';
import { createHero, heroOccupies, updateHero } from './hero.ts';
import type { Hero, HeroEvent } from './hero.ts';
import { padsForStage, unusedPadPoints } from './pads.ts';
import type { Cell, Dir } from './pyramid.ts';
import { createRng } from './rng.ts';
import type { Rng } from './rng.ts';
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

/** Points for luring the Chaser off the pyramid with a lift pad. */
export const CHASER_LURE_POINTS = 500;

export type Phase =
  /** `t` counts frames since the demo started or the hero last landed. */
  | { readonly kind: 'demo'; hop: number; t: number }
  | { readonly kind: 'playing' }
  /** Everything frozen after the hero is caught. */
  | { readonly kind: 'dying'; t: number }
  | { readonly kind: 'roundComplete'; readonly bonus: number; t: number }
  | { readonly kind: 'gameOver'; t: number };

export interface GameOptions {
  /** Where the game starts (default level 1 round 1). */
  readonly stage?: Stage;
  /** Seed for enemy spawns and bounces (default 1). */
  readonly seed?: number;
  /** Spawn enemies (default true). Off gives the empty pyramid of M2, for tests. */
  readonly enemies?: boolean;
  readonly lives?: number;
}

export interface Game {
  readonly options: GameOptions;
  /** Steps since the game was created (for animation timing). */
  frame: number;
  stage: Stage;
  score: number;
  lives: number;
  /** Score at which the next extra life is awarded. */
  nextExtraLife: number;
  board: Board;
  hero: Hero;
  phase: Phase;
  enemies: Enemy[];
  /** Lift pads still waiting beside the pyramid (off-pyramid cells). */
  pads: Cell[];
  /** Set while the hero rides a pad: where the Chaser should follow it off. */
  lure: Lure | null;
  /** Frames until the next spawn attempt. */
  spawnTimer: number;
  /** Enemies spawned since the round started. */
  spawnCount: number;
  nextEnemyId: number;
  readonly rng: Rng;
}

export type GameEvent =
  | { readonly kind: 'demoStart'; readonly level: number }
  | { readonly kind: 'roundStart'; readonly stage: Stage }
  | { readonly kind: 'cubeChanged'; readonly cell: Cell; readonly color: CubeColor; readonly points: number }
  | {
      readonly kind: 'roundComplete';
      readonly stage: Stage;
      /** Round bonus plus unused-pad points. */
      readonly bonus: number;
      readonly padBonus: number;
    }
  | { readonly kind: 'hero'; readonly event: HeroEvent }
  | { readonly kind: 'spawned'; readonly enemy: 'ball' | 'egg' }
  | { readonly kind: 'hatched' }
  | { readonly kind: 'padUsed'; readonly pad: Cell }
  | { readonly kind: 'chaserLured'; readonly points: number }
  | { readonly kind: 'caught'; readonly by: Enemy['kind'] }
  | { readonly kind: 'lifeLost'; readonly lives: number }
  | { readonly kind: 'extraLife'; readonly lives: number }
  | { readonly kind: 'gameOver'; readonly score: number };

export function createGame(options: GameOptions = {}): Game {
  const stage = options.stage ?? FIRST_STAGE;
  return {
    options,
    frame: 0,
    stage,
    score: 0,
    lives: options.lives ?? START_LIVES,
    nextExtraLife: FIRST_EXTRA_LIFE,
    board: createBoard(),
    hero: createHero(),
    phase: { kind: 'demo', hop: 0, t: 0 },
    enemies: [],
    pads: padsForStage(stage),
    lure: null,
    spawnTimer: FIRST_SPAWN_FRAMES,
    spawnCount: 0,
    nextEnemyId: 1,
    rng: createRng(options.seed ?? 1),
  };
}

export function currentRule(game: Game): ColorRule {
  return ruleForLevel(game.stage.level);
}

function sameCell(a: Cell | null, b: Cell | null): boolean {
  return a !== null && b !== null && a.row === b.row && a.col === b.col;
}

function addScore(game: Game, points: number, events: GameEvent[]): void {
  game.score += points;
  while (game.score >= game.nextExtraLife) {
    game.lives += 1;
    game.nextExtraLife += EXTRA_LIFE_EVERY;
    events.push({ kind: 'extraLife', lives: game.lives });
  }
}

/** Remove every enemy and restart the spawn clock (after a death, a ride or a round). */
function clearEnemies(game: Game): void {
  game.enemies = [];
  game.lure = null;
  game.spawnTimer = FIRST_SPAWN_FRAMES;
}

function resetForStage(game: Game): void {
  resetBoard(game.board);
  game.hero = createHero();
  game.pads = padsForStage(game.stage);
  game.spawnCount = 0;
  clearEnemies(game);
}

function startDemo(game: Game, events: GameEvent[]): void {
  resetForStage(game);
  game.phase = { kind: 'demo', hop: 0, t: 0 };
  events.push({ kind: 'demoStart', level: game.stage.level });
}

function startRound(game: Game, events: GameEvent[]): void {
  resetForStage(game);
  game.phase = { kind: 'playing' };
  events.push({ kind: 'roundStart', stage: game.stage });
}

function heroEvents(events: GameEvent[], heroEvts: HeroEvent[]): void {
  for (const event of heroEvts) events.push({ kind: 'hero', event });
}

/** Lose a life; returns true if that was the last one. */
function loseLife(game: Game, events: GameEvent[]): boolean {
  game.lives = Math.max(0, game.lives - 1);
  events.push({ kind: 'lifeLost', lives: game.lives });
  return game.lives === 0;
}

function enterGameOver(game: Game, events: GameEvent[]): void {
  game.phase = { kind: 'gameOver', t: 0 };
  events.push({ kind: 'gameOver', score: game.score });
}

function spawn(game: Game, events: GameEvent[]): void {
  const hasChaser = game.enemies.some((e) => e.kind !== 'ball');
  const balls = game.enemies.filter((e) => e.kind === 'ball').length;
  // The first spawn of a round is always a hazard ball; after that an egg whenever no
  // egg or Chaser is out, else another ball if there is room.
  let kind: 'ball' | 'egg' | null = null;
  if (game.spawnCount > 0 && !hasChaser) kind = 'egg';
  else if (balls < MAX_HAZARD_BALLS) kind = 'ball';
  if (kind === null) return;
  const to = DROP_CELLS[game.rng.int(DROP_CELLS.length)] ?? { row: 1, col: 0 };
  game.enemies.push(createEnemy(game.nextEnemyId++, kind, to));
  game.spawnCount += 1;
  events.push({ kind: 'spawned', enemy: kind });
}

/**
 * The enemy touching the hero this step, if any. Each counts as standing on its start cube
 * for the first half of a hop and on its target after, so they meet when those match. Two
 * hopping past each other that cross the halfway point on the same frame never share a
 * cube, so that swap is caught separately.
 */
function findCatcher(game: Game): Enemy | null {
  const heroCell = heroOccupies(game.hero);
  if (heroCell === null) return null;
  const hs = game.hero.state;
  const half = HOP_FRAMES / 2;
  for (const enemy of game.enemies) {
    if (sameCell(heroCell, enemyOccupies(enemy))) return enemy;
    const es = enemy.state;
    if (
      hs.kind === 'hopping' &&
      es.kind === 'hopping' &&
      hs.t >= half &&
      es.t >= half &&
      sameCell(hs.from, es.to) &&
      sameCell(hs.to, es.from)
    ) {
      return enemy;
    }
  }
  return null;
}

function updateDemo(game: Game, phase: Extract<Phase, { kind: 'demo' }>, events: GameEvent[]): void {
  const hero = game.hero;
  const rule = currentRule(game);
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
    return;
  }
  // Demo hops recolor cubes but never score; the hero pauses after every landing.
  const evts = updateHero(hero, null, null, {
    onLanded: (cell) => {
      const before = colorAt(game.board, cell);
      const r = landOnCell(game.board, rule, cell);
      if (r.color !== before) events.push({ kind: 'cubeChanged', cell, color: r.color, points: 0 });
      phase.t = 0;
      return false;
    },
  });
  heroEvents(events, evts);
}

function updatePlaying(game: Game, pressed: Dir | null, held: Dir | null, events: GameEvent[]): void {
  const rule = currentRule(game);
  const hero = game.hero;
  const hopFrom = hero.state.kind === 'hopping' ? hero.state.from : null;

  const evts = updateHero(hero, pressed, held, {
    isPad: (cell) => game.pads.some((p) => sameCell(p, cell)),
    onLanded: (cell) => {
      const before = colorAt(game.board, cell);
      const r = landOnCell(game.board, rule, cell);
      addScore(game, r.points, events);
      if (r.color !== before) events.push({ kind: 'cubeChanged', cell, color: r.color, points: r.points });
      if (!isComplete(game.board)) return true;
      const padBonus = game.pads.length * unusedPadPoints(game.stage);
      const bonus = roundBonus(game.stage) + padBonus;
      addScore(game, bonus, events);
      clearEnemies(game);
      game.phase = { kind: 'roundComplete', bonus, t: 0 };
      events.push({ kind: 'roundComplete', stage: game.stage, bonus, padBonus });
      return false;
    },
  });

  for (const e of evts) {
    if (e === 'boarded' && hero.state.kind === 'riding') {
      const pad = hero.state.pad;
      game.pads = game.pads.filter((p) => !sameCell(p, pad));
      if (hopFrom) game.lure = { cell: hopFrom, dir: hero.facing };
      events.push({ kind: 'padUsed', pad });
    } else if (e === 'arrived') {
      clearEnemies(game);
    } else if (e === 'fellOff') {
      clearEnemies(game);
      loseLife(game, events);
    }
  }
  heroEvents(events, evts);
  if (game.phase.kind !== 'playing') return;

  // Out of lives after a fall: game over once the fall has played out.
  if (hero.state.kind === 'respawning' && game.lives === 0) {
    enterGameOver(game, events);
    return;
  }

  // While the hero falls or waits to respawn the pyramid stays empty.
  const heroGone = hero.state.kind === 'falling' || hero.state.kind === 'respawning';
  if (heroGone || game.options.enemies === false) return;

  const target = heroOccupies(hero) ?? (hero.state.kind === 'hopping' ? hero.state.from : null);
  const ctx = { rng: game.rng, target, lure: game.lure };
  const gone = new Set<number>();
  for (const enemy of game.enemies) {
    for (const ev of updateEnemy(enemy, ctx)) {
      if (ev === 'hatched') events.push({ kind: 'hatched' });
      if (ev === 'lured') {
        addScore(game, CHASER_LURE_POINTS, events);
        events.push({ kind: 'chaserLured', points: CHASER_LURE_POINTS });
      }
      if (ev === 'gone') gone.add(enemy.id);
    }
  }
  if (gone.size > 0) game.enemies = game.enemies.filter((e) => !gone.has(e.id));

  // No spawns during a lift-pad ride.
  if (hero.state.kind !== 'riding') {
    game.spawnTimer -= 1;
    if (game.spawnTimer <= 0) {
      spawn(game, events);
      game.spawnTimer = SPAWN_INTERVAL_FRAMES;
    }
  }

  const catcher = findCatcher(game);
  if (catcher) {
    game.phase = { kind: 'dying', t: 0 };
    events.push({ kind: 'caught', by: catcher.kind });
  }
}

function updateDying(game: Game, phase: Extract<Phase, { kind: 'dying' }>, events: GameEvent[]): void {
  phase.t += 1;
  if (phase.t < DEATH_FREEZE_FRAMES) return;
  const hero = game.hero;
  // The hero stays where it was caught; enemies are cleared and the spawn clock restarts.
  hero.cell = heroOccupies(hero) ?? hero.cell;
  hero.state = { kind: 'idle' };
  hero.buffered = null;
  clearEnemies(game);
  if (loseLife(game, events)) enterGameOver(game, events);
  else game.phase = { kind: 'playing' };
}

function restart(game: Game, events: GameEvent[]): void {
  game.stage = game.options.stage ?? FIRST_STAGE;
  game.score = 0;
  game.lives = game.options.lives ?? START_LIVES;
  game.nextExtraLife = FIRST_EXTRA_LIFE;
  startDemo(game, events);
}

/**
 * Advance one simulation step. `pressed`/`held` are the player's input: used for hopping
 * while playing and, after game over, any press starts a new game. Mutates `game` and
 * returns what happened.
 */
export function updateGame(game: Game, pressed: Dir | null, held: Dir | null = null): GameEvent[] {
  const events: GameEvent[] = [];
  const phase = game.phase;
  game.frame += 1;

  switch (phase.kind) {
    case 'demo':
      updateDemo(game, phase, events);
      break;
    case 'playing':
      updatePlaying(game, pressed, held, events);
      break;
    case 'dying':
      updateDying(game, phase, events);
      break;
    case 'roundComplete':
      phase.t += 1;
      if (phase.t >= ROUND_FLASH_FRAMES) {
        const prevLevel = game.stage.level;
        game.stage = nextStage(game.stage);
        if (game.stage.level !== prevLevel) startDemo(game, events);
        else startRound(game, events);
      }
      break;
    case 'gameOver':
      phase.t += 1;
      if (phase.t >= GAME_OVER_MIN_FRAMES && pressed !== null) restart(game, events);
      break;
  }

  return events;
}
