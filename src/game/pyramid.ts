import { APEX_X, APEX_Y, CUBE_W, ROWS, ROW_STEP_Y } from './constants.ts';

/** A pyramid position. Valid cells satisfy 0 <= col <= row < ROWS. */
export interface Cell {
  readonly row: number;
  readonly col: number;
}

export type Dir = 'upLeft' | 'upRight' | 'downLeft' | 'downRight';

export const DIRS: readonly Dir[] = ['upLeft', 'upRight', 'downLeft', 'downRight'];

const DELTA: Readonly<Record<Dir, { readonly dr: number; readonly dc: number }>> = {
  upLeft: { dr: -1, dc: -1 },
  upRight: { dr: -1, dc: 0 },
  downLeft: { dr: 1, dc: 0 },
  downRight: { dr: 1, dc: 1 },
};

export const APEX: Cell = { row: 0, col: 0 };

export const CELL_COUNT = (ROWS * (ROWS + 1)) / 2; // 28

/** The cell reached by one hop; may be off the pyramid. */
export function step(cell: Cell, dir: Dir): Cell {
  const d = DELTA[dir];
  return { row: cell.row + d.dr, col: cell.col + d.dc };
}

export function isOnPyramid(cell: Cell): boolean {
  return (
    Number.isInteger(cell.row) &&
    Number.isInteger(cell.col) &&
    cell.row >= 0 &&
    cell.row < ROWS &&
    cell.col >= 0 &&
    cell.col <= cell.row
  );
}

/**
 * True when an off-pyramid cell lies behind the pyramid (hopping off a back edge),
 * so a falling hero should be drawn before the cubes. Falls off the bottom row are in front.
 */
export function isBehindPyramid(cell: Cell): boolean {
  return !isOnPyramid(cell) && cell.row < ROWS;
}

export function isUpward(dir: Dir): boolean {
  return dir === 'upLeft' || dir === 'upRight';
}

export function isLeftward(dir: Dir): boolean {
  return dir === 'upLeft' || dir === 'downLeft';
}

/** Index 0..27 in row-major order, for per-cube state arrays. */
export function cellIndex(cell: Cell): number {
  if (!isOnPyramid(cell)) throw new RangeError(`Cell (${cell.row}, ${cell.col}) is off the pyramid`);
  return (cell.row * (cell.row + 1)) / 2 + cell.col;
}

export function allCells(): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col <= row; col++) cells.push({ row, col });
  }
  return cells;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Screen position of the centre of a cell's top face. Works for off-pyramid cells too,
 * which is where a hero hopping off an edge lands before falling.
 */
export function cellToScreen(cell: Cell): Point {
  return {
    x: APEX_X + (cell.col - cell.row / 2) * CUBE_W,
    y: APEX_Y + cell.row * ROW_STEP_Y,
  };
}
