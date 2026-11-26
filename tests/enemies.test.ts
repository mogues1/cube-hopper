import { describe, expect, it } from 'vitest';
import {
  BALL_PAUSE_FRAMES,
  EGG_HATCH_FRAMES,
  ENEMY_DROP_FRAMES,
  FALL_FRAMES,
  HOP_FRAMES,
  ROWS,
} from '../src/game/constants.ts';
import { chaseDir, createEnemy, enemyOccupies, hopDistance, updateEnemy } from '../src/game/enemies.ts';
import type { Enemy, EnemyContext, EnemyEvent, Lure } from '../src/game/enemies.ts';
import { allCells, isOnPyramid, step } from '../src/game/pyramid.ts';
import type { Cell } from '../src/game/pyramid.ts';
import { createRng } from '../src/game/rng.ts';

function ctx(target: Cell | null = null, lure: Lure | null = null, seed = 7): EnemyContext {
  return { rng: createRng(seed), target, lure };
}

/** Run until `stop` returns true (or the frame cap), collecting events. */
function runUntil(enemy: Enemy, c: EnemyContext, stop: (e: EnemyEvent[]) => boolean, cap = 5000): EnemyEvent[] {
  const all: EnemyEvent[] = [];
  for (let i = 0; i < cap; i++) {
    const evts = updateEnemy(enemy, c);
    all.push(...evts);
    if (stop(evts)) return all;
  }
  throw new Error('enemy never reached the expected state');
}

function chaserAt(cell: Cell): Enemy {
  const e = createEnemy(1, 'egg', cell);
  e.kind = 'chaser';
  e.cell = cell;
  e.state = { kind: 'resting', t: 0 };
  return e;
}

describe('rng', () => {
  it('is deterministic per seed and in range', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      const x = a.int(4);
      expect(x).toBe(b.int(4));
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(4);
    }
  });
});

describe('hazard ball', () => {
  it('drops onto its row-1 cube, then only bounces downward and falls off the bottom', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const ball = createEnemy(1, 'ball', { row: 1, col: 1 });
      const c = ctx(null, null, seed);
      expect(enemyOccupies(ball)).toBeNull(); // not touchable while dropping in
      const rows: number[] = [];
      let fell = false;
      for (let i = 0; i < 2000 && !fell; i++) {
        for (const ev of updateEnemy(ball, c)) {
          if (ev === 'landed') rows.push(ball.cell.row);
          if (ev === 'fellOff') fell = true;
        }
      }
      expect(rows).toEqual([1, 2, 3, 4, 5, 6]);
      expect(fell).toBe(true);
      expect(ball.state.kind === 'falling' && !ball.state.behind).toBe(true);
      const tail = runUntil(ball, c, (e) => e.includes('gone'), FALL_FRAMES + 1);
      expect(tail).toEqual(['gone']);
    }
  });

  it('takes the drop time plus pause + hop per row', () => {
    const ball = createEnemy(1, 'ball', { row: 1, col: 0 });
    const c = ctx();
    let frames = 0;
    runUntil(ball, c, (e) => (frames++, e.includes('fellOff')));
    expect(frames).toBe(ENEMY_DROP_FRAMES + 6 * (BALL_PAUSE_FRAMES + HOP_FRAMES));
  });
});

describe('egg and Chaser', () => {
  it('the egg bounces to the bottom row, waits, then hatches there', () => {
    const egg = createEnemy(1, 'egg', { row: 1, col: 0 });
    const c = ctx();
    runUntil(egg, c, (e) => e.includes('landed') && egg.cell.row === ROWS - 1);
    const bottom = egg.cell;
    const events = runUntil(egg, c, (e) => e.includes('hatched'), EGG_HATCH_FRAMES + 1);
    expect(events).toEqual(['hatched']);
    expect(egg.kind).toBe('chaser');
    expect(egg.cell).toEqual(bottom);
  });

  it('hop distances are symmetric, zero on the diagonal, 6 from apex to the bottom row', () => {
    const cells = allCells();
    for (const a of cells) {
      expect(hopDistance(a, a)).toBe(0);
      for (const b of cells) expect(hopDistance(a, b)).toBe(hopDistance(b, a));
    }
    expect(hopDistance({ row: 0, col: 0 }, { row: 6, col: 0 })).toBe(6);
    expect(hopDistance({ row: 0, col: 0 }, { row: 6, col: 6 })).toBe(6);
  });

  it('every Chaser hop gets one hop closer and stays on the pyramid', () => {
    for (const from of allCells()) {
      for (const target of allCells()) {
        if (hopDistance(from, target) === 0) continue;
        const next = step(from, chaseDir(from, target));
        expect(isOnPyramid(next)).toBe(true);
        expect(hopDistance(next, target)).toBe(hopDistance(from, target) - 1);
      }
    }
  });

  it('catches a standing target in exactly hopDistance hops', () => {
    const chaser = chaserAt({ row: 6, col: 3 });
    const target = { row: 0, col: 0 };
    const c = ctx(target);
    let landings = 0;
    runUntil(chaser, c, (e) => {
      if (e.includes('landed')) landings++;
      return chaser.cell.row === 0;
    });
    expect(landings).toBe(6);
    expect(chaser.cell).toEqual(target);
  });

  it('waits in place when there is nothing to chase', () => {
    const chaser = chaserAt({ row: 4, col: 2 });
    const c = ctx(null);
    for (let i = 0; i < 200; i++) expect(updateEnemy(chaser, c)).toEqual([]);
    expect(chaser.state.kind).toBe('resting');
  });

  it('follows a lure to the edge and hops off after the hero', () => {
    const chaser = chaserAt({ row: 5, col: 0 });
    const lure: Lure = { cell: { row: 4, col: 0 }, dir: 'upLeft' };
    const events = runUntil(chaser, ctx({ row: 6, col: 6 }, lure), (e) => e.includes('lured'));
    expect(events).toEqual(['landed', 'fellOff', 'lured']);
    expect(chaser.lured).toBe(true);
    expect(chaser.state.kind === 'falling' && chaser.state.behind).toBe(true);
  });
});

describe('collision cells', () => {
  it('an enemy counts as on its start cube for the first half of a hop, then on the target', () => {
    const chaser = chaserAt({ row: 3, col: 1 });
    const c = ctx({ row: 6, col: 1 });
    expect(enemyOccupies(chaser)).toEqual({ row: 3, col: 1 });
    runUntil(chaser, c, () => chaser.state.kind === 'hopping');
    expect(enemyOccupies(chaser)).toEqual({ row: 3, col: 1 });
    for (let i = 0; i < HOP_FRAMES / 2; i++) updateEnemy(chaser, c);
    expect(enemyOccupies(chaser)).toEqual({ row: 4, col: 1 });
  });
});
