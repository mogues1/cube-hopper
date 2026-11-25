import { describe, expect, it } from 'vitest';
import { colorAt, createBoard, isComplete, landOnCell } from '../src/game/board.ts';
import { allCells } from '../src/game/pyramid.ts';
import {
  DESTINATION,
  FIRST_STAGE,
  INTERMEDIATE,
  LEVEL_COUNT,
  landOn,
  nextStage,
  roundBonus,
  ruleForLevel,
  RULES,
  START,
} from '../src/game/rules.ts';
import type { ColorRule, CubeColor, Stage } from '../src/game/rules.ts';

/** Colors a single cube shows over successive landings, starting from S. */
function sequence(rule: ColorRule, landings: number): CubeColor[] {
  const out: CubeColor[] = [];
  let c: CubeColor = START;
  for (let i = 0; i < landings; i++) {
    c = landOn(rule, c).color;
    out.push(c);
  }
  return out;
}

const S = START;
const I = INTERMEDIATE;
const D = DESTINATION;

describe('color rules', () => {
  it('L1 S→D: one hop finishes, finished cubes stay', () => {
    expect(sequence(RULES.oneHop, 4)).toEqual([D, D, D, D]);
  });

  it('L2 S→I→D: two hops finish, finished cubes stay', () => {
    expect(sequence(RULES.twoHop, 5)).toEqual([I, D, D, D, D]);
  });

  it('L3 S↔D: every hop toggles', () => {
    expect(sequence(RULES.toggle, 5)).toEqual([D, S, D, S, D]);
  });

  it('L4 S→I→D, D→I: a finished cube drops back to intermediate', () => {
    expect(sequence(RULES.twoHopRevertOne, 6)).toEqual([I, D, I, D, I, D]);
  });

  it('L5–9 S→I→D, D→S: a finished cube resets to start', () => {
    expect(sequence(RULES.twoHopRevertAll, 6)).toEqual([I, D, S, I, D, S]);
  });

  it('maps levels to rules', () => {
    expect(ruleForLevel(1)).toBe(RULES.oneHop);
    expect(ruleForLevel(2)).toBe(RULES.twoHop);
    expect(ruleForLevel(3)).toBe(RULES.toggle);
    expect(ruleForLevel(4)).toBe(RULES.twoHopRevertOne);
    for (let level = 5; level <= LEVEL_COUNT; level++) expect(ruleForLevel(level)).toBe(RULES.twoHopRevertAll);
    expect(() => ruleForLevel(0)).toThrow(RangeError);
    expect(() => ruleForLevel(10)).toThrow(RangeError);
  });

  it('intermediate flag matches whether the rule can reach intermediate from start', () => {
    for (const rule of Object.values(RULES)) {
      expect(rule.usesIntermediate, rule.name).toBe(rule.next[S] === I);
    }
  });
});

describe('cube scoring', () => {
  it('scores 15 for S→I and 25 for reaching D', () => {
    expect(landOn(RULES.twoHop, S).points).toBe(15);
    expect(landOn(RULES.twoHop, I).points).toBe(25);
    expect(landOn(RULES.oneHop, S).points).toBe(25);
  });

  it('scores nothing for a cube that stays or goes backward', () => {
    expect(landOn(RULES.oneHop, D).points).toBe(0);
    expect(landOn(RULES.twoHop, D).points).toBe(0);
    expect(landOn(RULES.toggle, D).points).toBe(0);
    expect(landOn(RULES.twoHopRevertOne, D).points).toBe(0);
    expect(landOn(RULES.twoHopRevertAll, D).points).toBe(0);
  });

  it('re-finishing a reverted cube scores again', () => {
    expect(landOn(RULES.toggle, S).points).toBe(25);
    expect(landOn(RULES.twoHopRevertOne, I).points).toBe(25);
  });
});

describe('board', () => {
  it('starts all start-colored and incomplete', () => {
    const board = createBoard();
    expect(board.colors).toHaveLength(28);
    expect(board.colors.every((c) => c === S)).toBe(true);
    expect(isComplete(board)).toBe(false);
  });

  it('is complete once every cube is at the destination', () => {
    const board = createBoard();
    const cells = allCells();
    for (const cell of cells.slice(0, -1)) landOnCell(board, RULES.oneHop, cell);
    expect(isComplete(board)).toBe(false);
    const last = cells.at(-1);
    if (!last) throw new Error('no cells');
    expect(landOnCell(board, RULES.oneHop, last)).toEqual({ color: D, points: 25 });
    expect(colorAt(board, last)).toBe(D);
    expect(isComplete(board)).toBe(true);
  });
});

describe('progression', () => {
  it('runs 9 levels × 4 rounds, then repeats level 9 round 4 forever', () => {
    const seen: Stage[] = [];
    let s = FIRST_STAGE;
    for (let i = 0; i < 40; i++) {
      seen.push(s);
      s = nextStage(s);
    }
    expect(seen[0]).toEqual({ level: 1, round: 1 });
    expect(seen[3]).toEqual({ level: 1, round: 4 });
    expect(seen[4]).toEqual({ level: 2, round: 1 });
    expect(seen[35]).toEqual({ level: 9, round: 4 });
    expect(seen.slice(35)).toEqual(Array(5).fill({ level: 9, round: 4 }));
  });

  it('round bonus is 1,000 at L1R1 and grows 250 per round', () => {
    expect(roundBonus({ level: 1, round: 1 })).toBe(1000);
    expect(roundBonus({ level: 1, round: 2 })).toBe(1250);
    expect(roundBonus({ level: 2, round: 1 })).toBe(2000);
    expect(roundBonus({ level: 4, round: 1 })).toBe(4000);
    expect(roundBonus({ level: 9, round: 4 })).toBe(9750);
  });
});
