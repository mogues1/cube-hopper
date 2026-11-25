// Lift pads: they float beside the pyramid's left and right edges and carry the hero to the top.

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

/**
 * Pad layouts for the four rounds of a level. Placeholder data until the per-round JSON
 * tables of M4; every level reuses these for now.
 */
const ROUND_PADS: readonly (readonly PadSpec[])[] = [
  [
    { side: 'left', row: 4 },
    { side: 'right', row: 4 },
  ],
  [
    { side: 'left', row: 3 },
    { side: 'right', row: 5 },
  ],
  [
    { side: 'left', row: 5 },
    { side: 'right', row: 2 },
  ],
  [
    { side: 'left', row: 2 },
    { side: 'right', row: 5 },
  ],
];

export function padsForStage(stage: Stage): Cell[] {
  const specs = ROUND_PADS[(stage.round - 1) % ROUND_PADS.length] ?? [];
  return specs.map(padCell);
}

/** Points per pad left unused when a round is cleared: 50 on level 1, 100 after (placeholder). */
export function unusedPadPoints(stage: Stage): number {
  return stage.level === 1 ? 50 : 100;
}
