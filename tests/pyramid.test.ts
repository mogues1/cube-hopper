import { describe, expect, it } from 'vitest';
import { APEX_X, APEX_Y, ROWS, ROW_STEP_Y } from '../src/game/constants.ts';
import {
  APEX,
  CELL_COUNT,
  allCells,
  cellIndex,
  cellToScreen,
  isBehindPyramid,
  isOnPyramid,
  step,
} from '../src/game/pyramid.ts';

describe('pyramid grid', () => {
  it('has 28 cells in 7 rows', () => {
    expect(CELL_COUNT).toBe(28);
    expect(allCells()).toHaveLength(28);
    expect(ROWS).toBe(7);
  });

  it('indexes every cell uniquely from 0 to 27', () => {
    const idx = allCells().map(cellIndex);
    expect(new Set(idx).size).toBe(28);
    expect(Math.min(...idx)).toBe(0);
    expect(Math.max(...idx)).toBe(27);
  });

  it('rejects off-pyramid cells', () => {
    expect(isOnPyramid({ row: -1, col: 0 })).toBe(false);
    expect(isOnPyramid({ row: 3, col: -1 })).toBe(false);
    expect(isOnPyramid({ row: 3, col: 4 })).toBe(false);
    expect(isOnPyramid({ row: 7, col: 0 })).toBe(false);
    expect(() => cellIndex({ row: 7, col: 0 })).toThrow();
  });
});

describe('diagonal hops', () => {
  it('moves to the four diagonal neighbours', () => {
    const c = { row: 3, col: 1 };
    expect(step(c, 'upLeft')).toEqual({ row: 2, col: 0 });
    expect(step(c, 'upRight')).toEqual({ row: 2, col: 1 });
    expect(step(c, 'downLeft')).toEqual({ row: 4, col: 1 });
    expect(step(c, 'downRight')).toEqual({ row: 4, col: 2 });
  });

  it('only the two down hops stay on the pyramid from the apex', () => {
    expect(isOnPyramid(step(APEX, 'upLeft'))).toBe(false);
    expect(isOnPyramid(step(APEX, 'upRight'))).toBe(false);
    expect(isOnPyramid(step(APEX, 'downLeft'))).toBe(true);
    expect(isOnPyramid(step(APEX, 'downRight'))).toBe(true);
  });

  it('every hop off a back edge falls behind; off the bottom falls in front', () => {
    for (const cell of allCells()) {
      for (const dir of ['upLeft', 'upRight'] as const) {
        const to = step(cell, dir);
        if (!isOnPyramid(to)) expect(isBehindPyramid(to)).toBe(true);
      }
    }
    expect(isBehindPyramid(step({ row: 6, col: 3 }, 'downLeft'))).toBe(false);
    expect(isBehindPyramid(step({ row: 6, col: 3 }, 'downRight'))).toBe(false);
  });

  it('each on-pyramid cell has a down neighbour unless it is on the bottom row', () => {
    for (const cell of allCells()) {
      const down = isOnPyramid(step(cell, 'downLeft'));
      expect(down).toBe(cell.row < ROWS - 1);
    }
  });
});

describe('isometric projection', () => {
  it('puts the apex at the configured point', () => {
    expect(cellToScreen(APEX)).toEqual({ x: APEX_X, y: APEX_Y });
  });

  it('rows step down by ROW_STEP_Y and rows are centred', () => {
    for (let row = 0; row < ROWS; row++) {
      const left = cellToScreen({ row, col: 0 });
      const right = cellToScreen({ row, col: row });
      expect(left.y).toBe(APEX_Y + row * ROW_STEP_Y);
      expect((left.x + right.x) / 2).toBe(APEX_X);
    }
  });

  it('keeps the whole pyramid inside the 256 x 240 screen', () => {
    for (const cell of allCells()) {
      const p = cellToScreen(cell);
      expect(p.x - 16).toBeGreaterThanOrEqual(0);
      expect(p.x + 16).toBeLessThanOrEqual(256);
      expect(p.y - 8).toBeGreaterThanOrEqual(0);
      expect(p.y + 8 + 16).toBeLessThanOrEqual(240);
    }
  });
});
