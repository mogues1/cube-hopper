// Per-cube color state for the 28-cube pyramid.

import { cellIndex, CELL_COUNT } from './pyramid.ts';
import type { Cell } from './pyramid.ts';
import { DESTINATION, landOn, START } from './rules.ts';
import type { ColorRule, CubeColor, LandResult } from './rules.ts';

export interface Board {
  readonly colors: CubeColor[];
}

export function createBoard(): Board {
  return { colors: new Array<CubeColor>(CELL_COUNT).fill(START) };
}

export function resetBoard(board: Board): void {
  board.colors.fill(START);
}

export function colorAt(board: Board, cell: Cell): CubeColor {
  return board.colors[cellIndex(cell)] ?? START;
}

/** Apply `rule` for a landing on `cell`; returns the new color and points scored. */
export function landOnCell(board: Board, rule: ColorRule, cell: Cell): LandResult {
  const i = cellIndex(cell);
  const result = landOn(rule, board.colors[i] ?? START);
  board.colors[i] = result.color;
  return result;
}

/** True once every cube shows the destination color. */
export function isComplete(board: Board): boolean {
  return board.colors.every((c) => c === DESTINATION);
}
