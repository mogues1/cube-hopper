import { describe, expect, it } from 'vitest';
import { colorAt, isComplete } from '../src/game/board.ts';
import {
  DEMO_END_FRAMES,
  DEMO_HOP_PAUSE_FRAMES,
  DEMO_START_FRAMES,
  HOP_FRAMES,
  ROUND_FLASH_FRAMES,
} from '../src/game/constants.ts';
import { createGame, currentRule, DEMO_PATH, updateGame } from '../src/game/game.ts';
import type { Game, GameEvent } from '../src/game/game.ts';
import { allCells, cellIndex, DIRS, isOnPyramid, step } from '../src/game/pyramid.ts';
import type { Cell, Dir } from '../src/game/pyramid.ts';
import { DESTINATION, INTERMEDIATE, landOn, START } from '../src/game/rules.ts';
import type { ColorRule, CubeColor, Stage } from '../src/game/rules.ts';

/** Demo length: each hop takes its start frame plus HOP_FRAMES, and one more frame starts the round. */
const DEMO_FRAMES =
  DEMO_START_FRAMES +
  DEMO_PATH.length * (HOP_FRAMES + 1) +
  (DEMO_PATH.length - 1) * DEMO_HOP_PAUSE_FRAMES +
  DEMO_END_FRAMES +
  1;

function run(game: Game, frames: number, input: Dir | null = null): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < frames; i++) events.push(...updateGame(game, input));
  return events;
}

/** Skip the level demo; fails if it does not end within its expected length. */
function skipDemo(game: Game): void {
  for (let i = 0; i < DEMO_FRAMES && game.phase.kind === 'demo'; i++) updateGame(game, null);
  expect(game.phase.kind).toBe('playing');
}

/** Hop once in `dir` and wait for the landing (or fall). */
function hop(game: Game, dir: Dir): GameEvent[] {
  return [...updateGame(game, dir), ...run(game, HOP_FRAMES)];
}

describe('level demo', () => {
  it('opens each game, recolors cubes without scoring, then starts round 1 on a fresh board', () => {
    const game = createGame({ enemies: false });
    expect(game.phase.kind).toBe('demo');
    const events = run(game, DEMO_FRAMES);
    // Level 1: each of the two cubes turns to the goal once, then stays.
    const changes = events.filter((e) => e.kind === 'cubeChanged');
    expect(changes).toHaveLength(2);
    expect(events.filter((e) => e.kind === 'hero' && e.event === 'landed')).toHaveLength(DEMO_PATH.length);
    expect(game.score).toBe(0);
    expect(events.at(-1)).toEqual({ kind: 'roundStart', stage: { level: 1, round: 1 } });
    expect(game.phase.kind).toBe('playing');
    expect(game.board.colors.every((c) => c === START)).toBe(true);
    expect(game.hero.cell).toEqual({ row: 0, col: 0 });
  });

  it('demonstrates the revert on levels that have one', () => {
    const game = createGame({ stage: { level: 5, round: 1 }, enemies: false });
    const colors = run(game, DEMO_FRAMES)
      .filter((e) => e.kind === 'cubeChanged')
      .map((e) => (e.kind === 'cubeChanged' ? e.color : -1));
    // Two cubes, each landed on three times: S→I, I→D, D→S.
    expect(colors).toEqual([INTERMEDIATE, INTERMEDIATE, DESTINATION, DESTINATION, START, START]);
  });

  it('ignores player input', () => {
    const game = createGame({ enemies: false });
    run(game, DEMO_START_FRAMES - 1, 'downRight');
    expect(game.hero.state.kind).toBe('idle');
  });
});

describe('playing a round', () => {
  it('landing recolors the cube and scores', () => {
    const game = createGame({ stage: { level: 2, round: 1 }, enemies: false });
    skipDemo(game);
    const events = hop(game, 'downRight');
    expect(events).toContainEqual({ kind: 'cubeChanged', cell: { row: 1, col: 1 }, color: INTERMEDIATE, points: 15 });
    expect(game.score).toBe(15);
    hop(game, 'upLeft');
    hop(game, 'downRight');
    expect(colorAt(game.board, { row: 1, col: 1 })).toBe(DESTINATION);
    expect(game.score).toBe(15 + 15 + 25);
  });

  it('a landing that changes nothing emits no cubeChanged', () => {
    const game = createGame({ enemies: false });
    skipDemo(game);
    hop(game, 'downRight');
    hop(game, 'upLeft');
    const events = hop(game, 'downRight');
    expect(events.some((e) => e.kind === 'cubeChanged')).toBe(false);
  });

  it('falling off keeps the board and respawns on the apex', () => {
    const game = createGame({ enemies: false });
    skipDemo(game);
    hop(game, 'downRight');
    const events = [...hop(game, 'upRight'), ...run(game, 200)];
    expect(events).toContainEqual({ kind: 'hero', event: 'respawned' });
    expect(colorAt(game.board, { row: 1, col: 1 })).toBe(DESTINATION);
    expect(game.hero.cell).toEqual({ row: 0, col: 0 });
  });
});

describe('round complete', () => {
  function finishAllButOne(game: Game, last: Cell): void {
    for (const cell of allCells()) {
      if (cell.row !== last.row || cell.col !== last.col) game.board.colors[cellIndex(cell)] = DESTINATION;
    }
  }

  it('awards the bonus, stops the hero even if a key is held, flashes, then starts the next round', () => {
    const game = createGame({ stage: { level: 1, round: 2 }, enemies: false });
    skipDemo(game);
    finishAllButOne(game, { row: 1, col: 0 });
    const scoreBefore = game.score;

    updateGame(game, 'downLeft', 'downLeft');
    const events: GameEvent[] = [];
    for (let i = 0; i < HOP_FRAMES; i++) events.push(...updateGame(game, null, 'downLeft'));

    // Round bonus 1,250 plus 2 unused lift pads × 50 on level 1.
    expect(events).toContainEqual({
      kind: 'roundComplete',
      stage: { level: 1, round: 2 },
      bonus: 1350,
      padBonus: 100,
    });
    expect(game.score).toBe(scoreBefore + 25 + 1350);
    expect(game.phase.kind).toBe('roundComplete');
    expect(game.hero.state.kind).toBe('idle');
    expect(isComplete(game.board)).toBe(true);

    // Input during the flash does nothing.
    const flash: GameEvent[] = [];
    for (let i = 0; i < ROUND_FLASH_FRAMES - 1; i++) flash.push(...updateGame(game, 'downRight', 'downRight'));
    expect(flash).toEqual([]);

    expect(updateGame(game, null)).toEqual([{ kind: 'roundStart', stage: { level: 1, round: 3 } }]);
    expect(game.board.colors.every((c) => c === START)).toBe(true);
    expect(game.hero.cell).toEqual({ row: 0, col: 0 });
  });

  it('after round 4 the next level opens with its demo', () => {
    const game = createGame({ stage: { level: 3, round: 4 }, enemies: false });
    skipDemo(game);
    finishAllButOne(game, { row: 1, col: 0 });
    hop(game, 'downLeft');
    const events = run(game, ROUND_FLASH_FRAMES);
    expect(events).toEqual([{ kind: 'demoStart', level: 4 }]);
    expect(game.stage).toEqual({ level: 4, round: 1 });
    expect(game.phase.kind).toBe('demo');
  });
});

// ---------------------------------------------------------------------------
// Exit criterion: an empty pyramid (no enemies) can be cleared through level 9.

/** Landings still needed to bring a cube of `color` to the destination under `rule`. */
function landingsToGoal(rule: ColorRule, color: CubeColor): number {
  let c = color;
  for (let n = 0; n < 4; n++) {
    if (c === DESTINATION) return n;
    c = landOn(rule, c).color;
  }
  throw new Error(`${rule.name} never reaches the destination`);
}

const LOOKAHEAD = 6;
const DISCOUNT = 0.8;

/**
 * Test bot: tries every hop sequence LOOKAHEAD deep and takes the first hop of the one with
 * the most discounted progress (landings-needed removed; earlier progress counts more).
 * Looking ahead lets it accept a revert now for a bigger gain later; a one-hop greedy router
 * ping-pongs forever on the revert rules (levels 3 and 5+).
 */
function botMove(game: Game): Dir {
  const rule = currentRule(game);
  const colors = game.board.colors.slice();

  const search = (cell: Cell, depth: number, weight: number): { score: number; dir: Dir | null } => {
    let best = { score: -Infinity, dir: null as Dir | null };
    for (const dir of DIRS) {
      const next = step(cell, dir);
      if (!isOnPyramid(next)) continue;
      const i = cellIndex(next);
      const before = colors[i] ?? START;
      const after = landOn(rule, before).color;
      colors[i] = after;
      const gain = (landingsToGoal(rule, before) - landingsToGoal(rule, after)) * weight;
      const rest = depth > 1 ? search(next, depth - 1, weight * DISCOUNT).score : 0;
      colors[i] = before;
      if (gain + rest > best.score) best = { score: gain + rest, dir };
    }
    return best;
  };

  const { dir } = search(game.hero.cell, LOOKAHEAD, 1);
  if (!dir) throw new Error('no legal hop');
  return dir;
}

describe('clearing an empty pyramid', () => {
  it('a bot clears all 36 rounds, level 1 through level 9, without falling', () => {
    const game = createGame({ enemies: false });
    const cleared: Stage[] = [];
    const hopsPerRound: number[] = [];
    let hops = 0;
    let falls = 0;

    for (let frame = 0; frame < 200_000 && cleared.length < 36; frame++) {
      const move = game.phase.kind === 'playing' && game.hero.state.kind === 'idle' ? botMove(game) : null;
      for (const e of updateGame(game, move)) {
        if (e.kind === 'hero' && e.event === 'hopStart') hops++;
        if (e.kind === 'hero' && e.event === 'fellOff') falls++;
        if (e.kind === 'roundComplete') {
          cleared.push(e.stage);
          hopsPerRound.push(hops);
        }
        if (e.kind === 'roundStart') hops = 0;
      }
    }

    expect(cleared).toHaveLength(36);
    expect(cleared[0]).toEqual({ level: 1, round: 1 });
    expect(cleared[35]).toEqual({ level: 9, round: 4 });
    expect(falls).toBe(0);
    // A round needs at least 28 landings (56 under two-step rules); the bot takes 46–83.
    expect(Math.max(...hopsPerRound)).toBeLessThan(100);
    // Cube points plus every round bonus (1,000 … 9,750).
    const bonuses = Array.from({ length: 36 }, (_, i) => 1000 + 250 * i).reduce((a, b) => a + b, 0);
    expect(game.score).toBeGreaterThan(bonuses);
  }, 30_000); // ~1 s normally; headroom for slow CI machines
});
