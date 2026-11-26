import { describe, expect, it } from 'vitest';
import {
  DEATH_FREEZE_FRAMES,
  EXTRA_LIFE_EVERY,
  FALL_FRAMES,
  FIRST_EXTRA_LIFE,
  GAME_OVER_MIN_FRAMES,
  HOP_FRAMES,
  START_LIVES,
} from '../src/game/constants.ts';
import { roundData } from '../src/game/config.ts';
import { createEnemy } from '../src/game/enemies.ts';
import type { Enemy } from '../src/game/enemies.ts';
import { CHASER_LURE_POINTS, createGame, updateGame } from '../src/game/game.ts';
import type { Game, GameEvent, GameOptions } from '../src/game/game.ts';
import { createHero, heroPose, RIDE_TOTAL_FRAMES, updateHero } from '../src/game/hero.ts';
import type { HeroEvent } from '../src/game/hero.ts';
import { padCell, padsForStage } from '../src/game/pads.ts';
import { cellToScreen, isOnPyramid, step } from '../src/game/pyramid.ts';
import type { Cell, Dir } from '../src/game/pyramid.ts';

function run(game: Game, frames: number, input: Dir | null = null): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < frames; i++) events.push(...updateGame(game, input));
  return events;
}

/** A game already in the playing phase (demo skipped), hero idle at `at`. */
function playing(options: GameOptions = {}, at: Cell = { row: 0, col: 0 }): Game {
  const game = createGame(options);
  for (let i = 0; i < 1000 && game.phase.kind === 'demo'; i++) updateGame(game, null);
  expect(game.phase.kind).toBe('playing');
  game.hero.cell = at;
  return game;
}

function place(game: Game, kind: Exclude<Enemy['kind'], 'crawler'>, cell: Cell): Enemy {
  const e = createEnemy(game.nextEnemyId++, kind === 'chaser' ? 'egg' : kind, cell);
  e.kind = kind;
  e.cell = cell;
  e.state = { kind: 'resting', t: 0 };
  game.enemies.push(e);
  return e;
}

const kinds = (events: GameEvent[]): string[] => events.map((e) => e.kind);

describe('lift pads', () => {
  it('sit beside an edge cube, one up-and-outward hop away', () => {
    for (let row = 1; row <= 6; row++) {
      const left = padCell({ side: 'left', row });
      const right = padCell({ side: 'right', row });
      expect(isOnPyramid(left)).toBe(false);
      expect(isOnPyramid(right)).toBe(false);
      expect(step({ row, col: 0 }, 'upLeft')).toEqual(left);
      expect(step({ row, col: row }, 'upRight')).toEqual(right);
    }
    expect(() => padCell({ side: 'left', row: 0 })).toThrow(RangeError);
  });

  it('every round has 2 pads, one per side', () => {
    for (let round = 1; round <= 4; round++) {
      const pads = padsForStage({ level: 1, round });
      expect(pads).toHaveLength(2);
      expect(pads.filter((p) => p.col === -1)).toHaveLength(1);
    }
  });

  it('a hop onto a pad rides to the top and lands on the apex instead of falling', () => {
    const hero = createHero();
    hero.cell = { row: 4, col: 0 };
    const pad = padCell({ side: 'left', row: 4 });
    const isPad = (c: Cell): boolean => c.row === pad.row && c.col === pad.col;
    const landed: Cell[] = [];
    const hooks = { isPad, onLanded: (c: Cell) => (landed.push(c), true) };
    const events: HeroEvent[] = [...updateHero(hero, 'upLeft', null, hooks)];
    for (let i = 0; i < HOP_FRAMES; i++) events.push(...updateHero(hero, null, null, hooks));
    expect(events).toEqual(['hopStart', 'boarded']);
    expect(hero.state.kind).toBe('riding');
    const start = heroPose(hero);
    for (let i = 0; i < RIDE_TOTAL_FRAMES / 2; i++) updateHero(hero, 'downRight', null, hooks); // input ignored
    expect(heroPose(hero).y).toBeLessThan(start.y);
    const rest: HeroEvent[] = [];
    for (let i = 0; i < RIDE_TOTAL_FRAMES; i++) rest.push(...updateHero(hero, null, null, hooks));
    expect(rest).toEqual(['arrived', 'landed']);
    expect(landed).toEqual([{ row: 0, col: 0 }]);
    expect(heroPose(hero)).toMatchObject(cellToScreen({ row: 0, col: 0 }));
  });

  it('in a game the pad is used up, enemies are cleared on arrival, and the apex is colored', () => {
    const game = playing({}, { row: 4, col: 0 }); // L1R1 has a left pad beside row 4
    place(game, 'ball', { row: 2, col: 1 });
    const events = [...updateGame(game, 'upLeft'), ...run(game, HOP_FRAMES)];
    expect(kinds(events)).toContain('padUsed');
    expect(game.pads).toHaveLength(1);
    const ride = run(game, RIDE_TOTAL_FRAMES);
    expect(ride).toContainEqual({ kind: 'hero', event: 'arrived' });
    expect(game.enemies).toEqual([]);
    expect(game.hero.cell).toEqual({ row: 0, col: 0 });
    expect(game.board.colors[0]).not.toBe(0);
  });

  it('no enemies spawn during a ride', () => {
    const game = playing({}, { row: 4, col: 0 });
    game.spawnTimer = 1;
    updateGame(game, 'upLeft');
    const events = run(game, HOP_FRAMES + RIDE_TOTAL_FRAMES - 2);
    expect(kinds(events)).not.toContain('spawned');
  });
});

describe('luring the Chaser', () => {
  it('a Chaser one hop behind follows the hero off the edge for 500 points', () => {
    const game = playing({}, { row: 4, col: 0 });
    place(game, 'chaser', { row: 5, col: 0 });
    const before = game.score;
    const events = [...updateGame(game, 'upLeft'), ...run(game, HOP_FRAMES + RIDE_TOTAL_FRAMES)];
    expect(events).toContainEqual({ kind: 'chaserLured', points: CHASER_LURE_POINTS });
    expect(kinds(events)).not.toContain('caught');
    // 500 for the lure, plus the apex landing at the end of the ride.
    expect(game.score - before).toBe(CHASER_LURE_POINTS + 25);
  });

  it('a Chaser too far behind is not lured, just cleared on arrival', () => {
    const game = playing({}, { row: 4, col: 0 });
    place(game, 'chaser', { row: 6, col: 6 });
    const events = [...updateGame(game, 'upLeft'), ...run(game, HOP_FRAMES + RIDE_TOTAL_FRAMES)];
    expect(kinds(events)).not.toContain('chaserLured');
    expect(game.enemies).toEqual([]);
  });
});

describe('spawning', () => {
  it('first a hazard ball, then the egg, at the spawn interval', () => {
    const game = playing();
    const { first: FIRST_SPAWN_FRAMES, interval: SPAWN_INTERVAL_FRAMES } = roundData({ level: 1, round: 1 }).spawn;
    const spawns: string[] = [];
    const at: number[] = [];
    for (let f = 1; f <= FIRST_SPAWN_FRAMES + SPAWN_INTERVAL_FRAMES; f++) {
      for (const e of updateGame(game, null)) {
        if (e.kind === 'spawned') {
          spawns.push(e.enemy);
          at.push(f);
        }
      }
    }
    expect(spawns).toEqual(['ball', 'egg']);
    expect(at).toEqual([FIRST_SPAWN_FRAMES, FIRST_SPAWN_FRAMES + SPAWN_INTERVAL_FRAMES]);
  });

  it('never more than one egg or Chaser at a time', () => {
    const game = playing({ seed: 3 });
    let max = 0;
    for (let f = 0; f < 3000 && game.phase.kind === 'playing'; f++) {
      updateGame(game, null);
      max = Math.max(max, game.enemies.filter((e) => e.kind !== 'ball').length);
    }
    expect(max).toBe(1);
  });

  it('enemies: false keeps the pyramid empty', () => {
    const game = playing({ enemies: false });
    run(game, 2000);
    expect(game.enemies).toEqual([]);
  });
});

describe('getting caught', () => {
  it('touching an enemy freezes play, then costs a life; the hero stays put and enemies clear', () => {
    const game = playing({}, { row: 2, col: 1 });
    place(game, 'ball', { row: 2, col: 1 });
    const caught = updateGame(game, null);
    expect(caught).toEqual([{ kind: 'caught', by: 'ball' }]);
    expect(game.phase.kind).toBe('dying');
    // Frozen: input and enemies do nothing.
    const frozen = run(game, DEATH_FREEZE_FRAMES - 1, 'downLeft');
    expect(frozen).toEqual([]);
    expect(game.hero.state.kind).toBe('idle');
    expect(updateGame(game, null)).toEqual([{ kind: 'lifeLost', lives: START_LIVES - 1 }]);
    expect(game.phase.kind).toBe('playing');
    expect(game.enemies).toEqual([]);
    expect(game.hero.cell).toEqual({ row: 2, col: 1 });
  });

  it('hopping into a resting enemy catches the hero on the second half of the hop', () => {
    const game = playing({}, { row: 2, col: 1 });
    place(game, 'chaser', { row: 3, col: 1 });
    game.enemies[0]!.state = { kind: 'resting', t: -10_000 }; // keep it still
    updateGame(game, 'downLeft');
    const events = run(game, HOP_FRAMES / 2);
    expect(kinds(events)).toEqual(['caught']);
    expect(game.hero.state.kind === 'hopping' && game.hero.state.t).toBe(HOP_FRAMES / 2);
  });

  it('hero and enemy swapping cubes collide mid-hop, whatever their timing', () => {
    // Enemy start offsets: -1 makes both cross halfway on the same frame.
    for (const offset of [-1, 0, 3, -4]) {
      const game = playing({}, { row: 2, col: 1 });
      const chaser = place(game, 'chaser', { row: 3, col: 1 });
      chaser.state = { kind: 'hopping', from: { row: 3, col: 1 }, to: { row: 2, col: 1 }, frames: HOP_FRAMES, t: offset };
      const events = [...updateGame(game, 'downLeft'), ...run(game, HOP_FRAMES)];
      const at = events.findIndex((e) => e.kind === 'caught');
      expect(at, `offset ${offset}`).toBeGreaterThanOrEqual(0);
      // Not caught while still a cube apart at the start of the hops.
      const hs = game.hero.state;
      expect(hs.kind === 'hopping' && hs.t, `offset ${offset}`).toBeGreaterThanOrEqual(HOP_FRAMES / 2 - 4);
    }
  });

  it('an enemy dropping in is harmless until it lands', () => {
    const game = playing({}, { row: 1, col: 0 });
    game.enemies.push(createEnemy(game.nextEnemyId++, 'ball', { row: 1, col: 0 }));
    expect(kinds(run(game, 5))).not.toContain('caught');
    expect(kinds(run(game, 40))).toContain('caught');
  });
});

describe('lives and game over', () => {
  it('falling off costs a life and clears the enemies', () => {
    const game = playing();
    place(game, 'ball', { row: 3, col: 1 });
    const events = [...updateGame(game, 'upLeft'), ...run(game, HOP_FRAMES)];
    expect(events).toContainEqual({ kind: 'lifeLost', lives: START_LIVES - 1 });
    expect(game.enemies).toEqual([]);
  });

  it('the last fall ends the game after the fall plays out; a key then starts a new game', () => {
    const game = playing({ lives: 1 });
    game.score = 1234;
    updateGame(game, 'upLeft');
    const fall = run(game, HOP_FRAMES + FALL_FRAMES);
    expect(fall).toContainEqual({ kind: 'lifeLost', lives: 0 });
    expect(fall).toContainEqual({ kind: 'gameOver', score: 1234 });
    expect(game.hero.state.kind).toBe('respawning'); // never comes back on the pyramid
    expect(game.phase.kind).toBe('gameOver');

    // Keys are ignored for a moment so a held key does not skip the screen.
    expect(run(game, GAME_OVER_MIN_FRAMES - 1, 'downRight')).toEqual([]);
    expect(updateGame(game, 'downRight')).toEqual([{ kind: 'demoStart', level: 1 }]);
    expect(game.score).toBe(0);
    expect(game.lives).toBe(1); // the configured start
    expect(game.stage).toEqual({ level: 1, round: 1 });
  });

  it('an idle player on level 1 is caught by the Chaser until the game is over', () => {
    const game = playing({ seed: 11 });
    const events = run(game, 20_000);
    const caught = events.filter((e) => e.kind === 'caught');
    expect(caught).toHaveLength(START_LIVES);
    expect(caught.every((e) => e.kind === 'caught' && e.by === 'chaser')).toBe(true);
    expect(kinds(events).filter((k) => k === 'hatched').length).toBeGreaterThanOrEqual(START_LIVES);
    expect(game.phase.kind).toBe('gameOver');
  });

  it('awards an extra life at 8,000 and every 14,000 after', () => {
    const game = playing();
    game.score = FIRST_EXTRA_LIFE - 10;
    const lives = game.lives;
    const events = [...updateGame(game, 'downLeft'), ...run(game, HOP_FRAMES)];
    expect(events).toContainEqual({ kind: 'extraLife', lives: lives + 1 });
    expect(game.nextExtraLife).toBe(FIRST_EXTRA_LIFE + EXTRA_LIFE_EVERY);
    expect(EXTRA_LIFE_EVERY).toBe(14000);
  });
});
