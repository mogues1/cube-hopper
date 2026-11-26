import { describe, expect, it } from 'vitest';
import { colorAt } from '../src/game/board.ts';
import { levelData, roundData, SPAWN_KINDS } from '../src/game/config.ts';
import type { SpawnKind } from '../src/game/config.ts';
import { DEATH_FREEZE_FRAMES } from '../src/game/constants.ts';
import {
  createCrawler,
  createEnemy,
  crawlerEntry,
  enemyOccupies,
  enemyPose,
  facePoint,
  updateEnemy,
} from '../src/game/enemies.ts';
import type { Enemy, EnemyEvent } from '../src/game/enemies.ts';
import { createGame, FREEZE_ORB_POINTS, UNDOER_POINTS, updateGame } from '../src/game/game.ts';
import type { Game, GameEvent, GameOptions } from '../src/game/game.ts';
import { cellToScreen, DIRS, isOnPyramid, step } from '../src/game/pyramid.ts';
import type { Cell, Dir } from '../src/game/pyramid.ts';
import { createRng } from '../src/game/rng.ts';
import { DESTINATION, START } from '../src/game/rules.ts';
import type { Stage } from '../src/game/rules.ts';

const L1 = levelData(1).speed;

function run(game: Game, frames: number, input: Dir | null = null): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < frames; i++) events.push(...updateGame(game, input));
  return events;
}

function playing(options: GameOptions = {}, at: Cell = { row: 0, col: 0 }): Game {
  const game = createGame(options);
  for (let i = 0; i < 1000 && game.phase.kind === 'demo'; i++) updateGame(game, null);
  expect(game.phase.kind).toBe('playing');
  game.hero.cell = at;
  game.spawnTimer = 1_000_000; // tests place their own enemies
  return game;
}

function place(game: Game, kind: 'ball' | 'freezeOrb' | 'undoer', cell: Cell, restT = 0): Enemy {
  const e = createEnemy(game.nextEnemyId++, kind, cell);
  e.state = { kind: 'resting', t: restT };
  game.enemies.push(e);
  return e;
}

const kinds = (events: GameEvent[]): string[] => events.map((e) => e.kind);

describe('side crawlers', () => {
  for (const side of ['left', 'right'] as const) {
    it(`a ${side}-side crawler walks in from its bottom corner, across and up, and off the far edge`, () => {
      for (let seed = 1; seed <= 15; seed++) {
        const c = createCrawler(1, side, L1.enemyHop);
        const ctx = { rng: createRng(seed), speed: L1, target: null, lure: null };
        expect(enemyOccupies(c)).toBeNull(); // harmless while still coming in from off the pyramid
        const visited: Cell[] = [];
        const events: EnemyEvent[] = [];
        for (let i = 0; i < 3000 && !events.includes('gone'); i++) {
          for (const ev of updateEnemy(c, ctx)) {
            events.push(ev);
            if (ev === 'landed') visited.push(c.cell);
          }
        }
        expect(visited[0]).toEqual(crawlerEntry(side).to);
        for (let i = 1; i < visited.length; i++) {
          const dr = visited[i]!.row - visited[i - 1]!.row;
          const dc = visited[i]!.col - visited[i - 1]!.col;
          // Left side: right (0,+1) or up-right (−1,0). Right side mirrors: (0,−1) or (−1,−1).
          const ok = side === 'left' ? [[0, 1], [-1, 0]] : [[0, -1], [-1, -1]];
          expect(ok.some(([r, k]) => r === dr && k === dc), `seed ${seed} step ${i}`).toBe(true);
        }
        expect(visited.every(isOnPyramid)).toBe(true);
        expect(events.filter((e) => e === 'fellOff')).toHaveLength(1);
        expect(events.at(-1)).toBe('gone');
      }
    });
  }

  it('is drawn on the side face, left or right of the cube top', () => {
    const cell = { row: 3, col: 1 };
    const top = cellToScreen(cell);
    expect(facePoint(cell, 'left').x).toBeLessThan(top.x);
    expect(facePoint(cell, 'right').x).toBeGreaterThan(top.x);
    expect(facePoint(cell, 'left').y).toBeGreaterThan(top.y);
    const c = createCrawler(1, 'left', L1.enemyHop);
    c.cell = cell;
    c.state = { kind: 'resting', t: 0 };
    expect(enemyPose(c)).toMatchObject(facePoint(cell, 'left'));
  });

  it('catches the hero standing on the cube whose side it is on', () => {
    const game = playing({}, { row: 5, col: 2 });
    const c = createCrawler(game.nextEnemyId++, 'left', L1.enemyHop);
    c.cell = { row: 5, col: 2 };
    c.state = { kind: 'resting', t: 0 };
    game.enemies.push(c);
    expect(updateGame(game, null)).toEqual([{ kind: 'caught', by: 'crawler' }]);
  });
});

describe('freeze orb', () => {
  it('bounces down like a hazard ball', () => {
    const orb = createEnemy(1, 'freezeOrb', { row: 1, col: 0 });
    const ctx = { rng: createRng(5), speed: L1, target: null, lure: null };
    const rows: number[] = [];
    for (let i = 0; i < 2000; i++) for (const ev of updateEnemy(orb, ctx)) if (ev === 'landed') rows.push(orb.cell.row);
    expect(rows).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('catching it scores 100 and freezes every enemy, then they move again', () => {
    const game = playing({}, { row: 2, col: 1 });
    place(game, 'freezeOrb', { row: 3, col: 1 }, -10_000);
    const ball = place(game, 'ball', { row: 4, col: 4 }, -L1.heroHop); // rests through the hero's hop
    const score = game.score;
    const events = [...updateGame(game, 'downLeft'), ...run(game, L1.heroHop)];
    expect(events).toContainEqual({ kind: 'collected', enemy: 'freezeOrb', points: FREEZE_ORB_POINTS });
    expect(events).toContainEqual({ kind: 'frozen', frames: L1.freeze });
    expect(game.score).toBe(score + FREEZE_ORB_POINTS + 25);
    expect(game.enemies).toEqual([ball]);

    const where = { ...ball.cell };
    game.spawnTimer = 1; // would spawn now if not frozen
    const frozen = run(game, game.freezeTimer - 1);
    expect(kinds(frozen)).not.toContain('spawned');
    expect(ball.cell).toEqual(where);
    expect(ball.state.kind).toBe('resting');

    expect(updateGame(game, null)).toEqual([{ kind: 'thawed' }]);
    // Moving again: it finishes its rest and hops within one full rest + hop.
    for (let i = 0; i < L1.heroHop + L1.ballRest + L1.enemyHop + 2 && ball.cell.row === where.row; i++) {
      updateGame(game, null);
    }
    expect(ball.cell).not.toEqual(where);
  });

  it('frozen enemies are still deadly to touch', () => {
    const game = playing({}, { row: 2, col: 1 });
    game.freezeTimer = 200;
    place(game, 'ball', { row: 3, col: 1 });
    const events = [...updateGame(game, 'downLeft'), ...run(game, L1.heroHop)];
    expect(kinds(events)).toContain('caught');
  });
});

describe('Undoers', () => {
  it('turn finished cubes they land on back to the start color', () => {
    const game = playing({ stage: { level: 2, round: 1 } }, { row: 6, col: 6 });
    game.board.colors.fill(DESTINATION);
    const undoer = place(game, 'undoer', { row: 1, col: 0 });
    const changed: Cell[] = [];
    for (let i = 0; i < 2000 && game.enemies.includes(undoer); i++) {
      for (const e of updateGame(game, null)) if (e.kind === 'cubeChanged') changed.push(e.cell);
    }
    expect(changed.map((c) => c.row)).toEqual([2, 3, 4, 5, 6]);
    for (const c of changed) expect(colorAt(game.board, c)).toBe(START);
    expect(game.phase.kind).toBe('playing');
  });

  it('catching one scores 300 and costs no life', () => {
    const game = playing({}, { row: 2, col: 1 });
    place(game, 'undoer', { row: 3, col: 1 }, -10_000);
    const lives = game.lives;
    const events = [...updateGame(game, 'downLeft'), ...run(game, L1.heroHop + DEATH_FREEZE_FRAMES)];
    expect(events).toContainEqual({ kind: 'collected', enemy: 'undoer', points: UNDOER_POINTS });
    expect(kinds(events)).not.toContain('caught');
    expect(game.lives).toBe(lives);
    expect(game.enemies).toEqual([]);
  });
});

describe('speed curve in play', () => {
  it('the hero hops faster on later levels', () => {
    for (const level of [1, 5, 9]) {
      const game = playing({ stage: { level, round: 1 } });
      updateGame(game, 'downRight');
      let frames = 0;
      while (frames < 100 && !updateGame(game, null).some((e) => e.kind === 'hero' && e.event === 'landed')) frames++;
      frames += 1;
      expect(frames, `level ${level}`).toBe(levelData(level).speed.heroHop);
    }
    expect(levelData(9).speed.heroHop).toBeLessThan(levelData(1).speed.heroHop);
  });
});

/** A hero that hops at random but never off the pyramid, so rounds run with enemies around it. */
function wander(game: Game, rng: ReturnType<typeof createRng>): Dir | null {
  if (game.phase.kind !== 'playing' || game.hero.state.kind !== 'idle') return null;
  const ok = DIRS.filter((d) => isOnPyramid(step(game.hero.cell, d)));
  return ok[rng.int(ok.length)] ?? null;
}

describe('all 36 rounds', () => {
  const stages: Stage[] = [];
  for (let level = 1; level <= 9; level++) for (let round = 1; round <= 4; round++) stages.push({ level, round });

  for (const stage of stages) {
    it(`L${stage.level}R${stage.round} runs with its table's enemies and stays consistent`, () => {
      const game = createGame({ stage, seed: stage.level * 10 + stage.round, lives: 99 });
      const rng = createRng(stage.level * 100 + stage.round);
      const spawned = new Set<SpawnKind | 'egg'>();
      const table = roundData(stage).spawn;
      // Plain checks inside the loop (expect() per frame is too slow for 36 × 4000 frames).
      const problems = new Set<string>();
      for (let f = 0; f < 4000; f++) {
        for (const e of updateGame(game, wander(game, rng))) if (e.kind === 'spawned') spawned.add(e.enemy);
        if (game.stage.level !== stage.level || game.stage.round !== stage.round) break;
        for (const enemy of game.enemies) {
          const occ = enemyOccupies(enemy);
          if (occ && !isOnPyramid(occ)) problems.add(`${enemy.kind} occupies an off-pyramid cell`);
          if (enemy.state.kind === 'resting' && !isOnPyramid(enemy.cell)) problems.add(`${enemy.kind} rests off the pyramid`);
        }
        if (game.enemies.filter((e) => e.kind === 'egg' || e.kind === 'chaser').length > 1) problems.add('two Chasers');
        if (game.enemies.filter((e) => e.kind === 'ball').length > table.maxBalls) problems.add('too many balls');
        if (!game.board.colors.every((c) => c >= 0 && c <= 2)) problems.add('bad cube color');
        if (!isOnPyramid(game.hero.cell)) problems.add('hero off the pyramid');
      }
      expect([...problems]).toEqual([]);
      const allowed = new Set<string>([...SPAWN_KINDS.filter((k) => table.weights[k]), 'egg']);
      for (const k of spawned) expect(allowed.has(k), `${k} spawned`).toBe(true);
      expect(spawned.has('ball')).toBe(true);
      expect(spawned.has('egg')).toBe(true);
    });
  }
});
