// Color rules, scoring and level/round progression. Pure data and functions, no DOM.

/** A cube top's color: start, intermediate or destination (the goal). */
export const START = 0;
export const INTERMEDIATE = 1;
export const DESTINATION = 2;
export type CubeColor = typeof START | typeof INTERMEDIATE | typeof DESTINATION;

export interface ColorRule {
  /** Short label for tests and debugging, e.g. "S→I→D, D→S". */
  readonly name: string;
  /** Color after the hero lands on a cube of color [current]. */
  readonly next: readonly [CubeColor, CubeColor, CubeColor];
  /** Whether the intermediate color is used (shown in the HUD goal sequence). */
  readonly usesIntermediate: boolean;
}

/** The five rules from the design spec (docs/DESIGN.md). */
export const RULES = {
  /** L1: one hop finishes a cube; finished cubes stay. */
  oneHop: { name: 'S→D', next: [DESTINATION, DESTINATION, DESTINATION], usesIntermediate: false },
  /** L2: two hops finish a cube; finished cubes stay. */
  twoHop: { name: 'S→I→D', next: [INTERMEDIATE, DESTINATION, DESTINATION], usesIntermediate: true },
  /** L3: every hop toggles between start and destination. */
  toggle: { name: 'S↔D', next: [DESTINATION, DESTINATION, START], usesIntermediate: false },
  /** L4: two hops finish a cube; hopping a finished cube drops it back to intermediate. */
  twoHopRevertOne: {
    name: 'S→I→D, D→I',
    next: [INTERMEDIATE, DESTINATION, INTERMEDIATE],
    usesIntermediate: true,
  },
  /** L5–9: two hops finish a cube; hopping a finished cube resets it to start. */
  twoHopRevertAll: {
    name: 'S→I→D, D→S',
    next: [INTERMEDIATE, DESTINATION, START],
    usesIntermediate: true,
  },
} as const satisfies Record<string, ColorRule>;

export const LEVEL_COUNT = 9;
export const ROUNDS_PER_LEVEL = 4;

const LEVEL_RULES: readonly ColorRule[] = [
  RULES.oneHop,
  RULES.twoHop,
  RULES.toggle,
  RULES.twoHopRevertOne,
  RULES.twoHopRevertAll,
  RULES.twoHopRevertAll,
  RULES.twoHopRevertAll,
  RULES.twoHopRevertAll,
  RULES.twoHopRevertAll,
];

export function ruleForLevel(level: number): ColorRule {
  const rule = LEVEL_RULES[level - 1];
  if (!rule) throw new RangeError(`No level ${level}`);
  return rule;
}

/** Points for a cube changing color; only progress toward the goal scores. */
export const POINTS_INTERMEDIATE = 15;
export const POINTS_DESTINATION = 25;

export interface LandResult {
  readonly color: CubeColor;
  readonly points: number;
}

/** What landing on a cube of `color` does under `rule`. */
export function landOn(rule: ColorRule, color: CubeColor): LandResult {
  const next = rule.next[color];
  let points = 0;
  if (next === DESTINATION && color !== DESTINATION) points = POINTS_DESTINATION;
  else if (next === INTERMEDIATE && color === START) points = POINTS_INTERMEDIATE;
  return { color: next, points };
}

/** A position in the game's 9 × 4 round sequence (both 1-based). */
export interface Stage {
  readonly level: number;
  readonly round: number;
}

export const FIRST_STAGE: Stage = { level: 1, round: 1 };

/** The round after `s`. Level 9's last round repeats forever. */
export function nextStage(s: Stage): Stage {
  if (s.round < ROUNDS_PER_LEVEL) return { level: s.level, round: s.round + 1 };
  if (s.level < LEVEL_COUNT) return { level: s.level + 1, round: 1 };
  return s;
}

/** 0-based index of a stage in the 36-round sequence. */
export function stageIndex(s: Stage): number {
  return (s.level - 1) * ROUNDS_PER_LEVEL + (s.round - 1);
}

export const ROUND_BONUS_BASE = 1000;
export const ROUND_BONUS_STEP = 250;

/** Bonus for clearing a round: 1,000 at L1R1, +250 per round after (L4R1 = 4,000). */
export function roundBonus(s: Stage): number {
  return ROUND_BONUS_BASE + ROUND_BONUS_STEP * stageIndex(s);
}
