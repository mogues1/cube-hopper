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
  GAME_OVER_MIN_FRAMES,
  ROUND_FLASH_FRAMES,
  START_LIVES,
} from './constants.ts';
import { levelData, roundData } from './config.ts';
import type { SpawnKind } from './config.ts';
import { spritesTouch } from './collide.ts';
import type { Placed } from './collide.ts';
import { createCrawler, createEnemy, DROP_CELLS, enemyCells, enemyPose, updateEnemy } from './enemies.ts';
import type { Enemy, Lure } from './enemies.ts';
import { createHero, heroCells, heroOccupies, heroPose, updateHero } from './hero.ts';
import { enemyLook, heroLook } from './looks.ts';
import type { Hero, HeroEvent } from './hero.ts';
import { padsForStage, unusedPadPoints } from './pads.ts';
import { cellIndex } from './pyramid.ts';
import type { Cell, Dir } from './pyramid.ts';
import { createRng } from './rng.ts';
import type { Rng } from './rng.ts';
import { FIRST_STAGE, nextStage, roundBonus, ruleForLevel, START } from './rules.ts';
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
/** Points for catching the freeze orb and an Undoer. */
export const FREEZE_ORB_POINTS = 100;
export const UNDOER_POINTS = 300;

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
  /** Frames the enemies stay frozen after the hero catches a freeze orb (0 = not frozen). */
  freezeTimer: number;
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
  | { readonly kind: 'spawned'; readonly enemy: SpawnKind | 'egg' }
  | { readonly kind: 'collected'; readonly enemy: 'freezeOrb' | 'undoer'; readonly points: number }
  | { readonly kind: 'frozen'; readonly frames: number }
  | { readonly kind: 'thawed' }
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
    hero: createHero(levelData(stage.level).speed.heroHop),
    phase: { kind: 'demo', hop: 0, t: 0 },
    enemies: [],
    pads: padsForStage(stage),
    lure: null,
    spawnTimer: roundData(stage).spawn.first,
    spawnCount: 0,
    freezeTimer: 0,
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
  game.freezeTimer = 0;
  game.spawnTimer = roundData(game.stage).spawn.first;
}

function resetForStage(game: Game): void {
  resetBoard(game.board);
  game.hero = createHero(levelData(game.stage.level).speed.heroHop);
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

/** How many of each spawnable kind may be out at once (hazard balls come from the table). */
const SPAWN_CAPS: Readonly<Record<Exclude<SpawnKind, 'ball'>, number>> = {
  freezeOrb: 1,
  crawlerLeft: 1,
  crawlerRight: 1,
  undoer: 1,
};

function countOut(game: Game, kind: SpawnKind): number {
  return game.enemies.filter((e) => {
    if (kind === 'crawlerLeft') return e.kind === 'crawler' && e.side === 'left';
    if (kind === 'crawlerRight') return e.kind === 'crawler' && e.side === 'right';
    return e.kind === kind;
  }).length;
}

/**
 * One spawn from the round's table. The first spawn of a round is always a hazard ball;
 * after that the egg comes whenever no egg or Chaser is out, otherwise a weighted random
 * pick among the kinds still under their cap. Nothing spawns if every kind is capped.
 */
function spawn(game: Game, events: GameEvent[]): void {
  const table = roundData(game.stage).spawn;
  const hasChaser = game.enemies.some((e) => e.kind === 'egg' || e.kind === 'chaser');
  let kind: SpawnKind | 'egg' | null = null;
  if (game.spawnCount === 0) {
    kind = countOut(game, 'ball') < table.maxBalls ? 'ball' : null;
  } else if (table.egg && !hasChaser) {
    kind = 'egg';
  } else {
    const open = (Object.entries(table.weights) as [SpawnKind, number][]).filter(([k]) =>
      k === 'ball' ? countOut(game, k) < table.maxBalls : countOut(game, k) < SPAWN_CAPS[k],
    );
    const total = open.reduce((n, [, w]) => n + w, 0);
    let roll = game.rng.next() * total;
    for (const [k, w] of open) {
      roll -= w;
      if (roll < 0) {
        kind = k;
        break;
      }
    }
  }
  if (kind === null) return;

  const id = game.nextEnemyId++;
  if (kind === 'crawlerLeft' || kind === 'crawlerRight') {
    const hop = levelData(game.stage.level).speed.enemyHop;
    game.enemies.push(createCrawler(id, kind === 'crawlerLeft' ? 'left' : 'right', hop));
  } else {
    const to = DROP_CELLS[game.rng.int(DROP_CELLS.length)] ?? { row: 1, col: 0 };
    game.enemies.push(createEnemy(id, kind, to));
  }
  game.spawnCount += 1;
  events.push({ kind: 'spawned', enemy: kind });
}

/**
 * The enemies touching the hero this step. Two things must both hold:
 *  1. They share a cube: one the hero stands on or is hopping between, and one the enemy
 *     stands on, is hopping between, or is dropping onto. This keeps sprites that merely
 *     overlap on screen across different cubes (the isometric view stacks them) from counting.
 *  2. Their sprites visibly touch: a drawn pixel of one overlaps or is next to a drawn pixel
 *     of the other, using exactly the sprites and positions the renderer draws.
 */
function touching(game: Game): Enemy[] {
  const heroAt = heroCells(game.hero);
  if (heroAt.length === 0) return [];
  const hero: Placed = { ...heroLook(game.hero), at: heroPose(game.hero) };
  return game.enemies.filter((enemy) => {
    const shared = enemyCells(enemy).some((c) => heroAt.some((h) => sameCell(h, c)));
    return shared && spritesTouch(hero, { ...enemyLook(enemy), at: enemyPose(enemy) });
  });
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

  const level = levelData(game.stage.level);
  if (game.freezeTimer > 0) {
    // Frozen: enemies stand still and nothing spawns, but touching them still counts.
    game.freezeTimer -= 1;
    if (game.freezeTimer === 0) events.push({ kind: 'thawed' });
  } else {
    const target = heroOccupies(hero) ?? (hero.state.kind === 'hopping' ? hero.state.from : null);
    const ctx = { rng: game.rng, speed: level.speed, target, lure: game.lure };
    const gone = new Set<number>();
    for (const enemy of game.enemies) {
      for (const ev of updateEnemy(enemy, ctx)) {
        if (ev === 'hatched') events.push({ kind: 'hatched' });
        if (ev === 'lured') {
          addScore(game, CHASER_LURE_POINTS, events);
          events.push({ kind: 'chaserLured', points: CHASER_LURE_POINTS });
        }
        // An Undoer turns every cube it lands on back to the start color.
        if (ev === 'landed' && enemy.kind === 'undoer' && colorAt(game.board, enemy.cell) !== START) {
          game.board.colors[cellIndex(enemy.cell)] = START;
          events.push({ kind: 'cubeChanged', cell: enemy.cell, color: START, points: 0 });
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
        game.spawnTimer = roundData(game.stage).spawn.interval;
      }
    }
  }

  // Catchable enemies are collected first; any other contact costs a life.
  let catcher: Enemy | null = null;
  for (const enemy of touching(game)) {
    if (enemy.kind === 'freezeOrb' || enemy.kind === 'undoer') {
      game.enemies = game.enemies.filter((e) => e !== enemy);
      const points = enemy.kind === 'freezeOrb' ? FREEZE_ORB_POINTS : UNDOER_POINTS;
      addScore(game, points, events);
      events.push({ kind: 'collected', enemy: enemy.kind, points });
      if (enemy.kind === 'freezeOrb') {
        game.freezeTimer = level.speed.freeze;
        events.push({ kind: 'frozen', frames: level.speed.freeze });
      }
    } else {
      catcher ??= enemy;
    }
  }
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
