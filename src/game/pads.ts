// Lift pads: they float beside the pyramid's left and right edges and carry the hero to the top.

import { levelData, roundData } from './config.ts';
import { ROWS } from './constants.ts';
import type { Cell } from './pyramid.ts';
import type { Stage } from './rules.ts';

export type Side = 'left' | 'right';

/** A pad next to the edge cube on `row` (1..6) of the given side. */
export interface PadSpec {
  readonly side: Side;
  readonly row: number;
}

/**
 * The off-pyramid cell a pad occupies: the one reached by hopping up and outward from the
 * edge cube on `row` (up-left from (row, 0), up-right from (row, row)).
 */
export function padCell(spec: PadSpec): Cell {
  if (spec.row < 1 || spec.row >= ROWS) throw new RangeError(`No pad beside row ${spec.row}`);
  return spec.side === 'left' ? { row: spec.row - 1, col: -1 } : { row: spec.row - 1, col: spec.row };
}

/** Pad cells for a round, from src/data/rounds.json. */
export function padsForStage(stage: Stage): Cell[] {
  return roundData(stage).pads.map(padCell);
}

/** Points per pad left unused when a round is cleared. */
export function unusedPadPoints(stage: Stage): number {
  return levelData(stage.level).padPoints;
}
