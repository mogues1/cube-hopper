// Level and round data from src/data/rounds.json, checked at load so a bad edit fails fast
// with a clear message instead of misbehaving mid-game.

import raw from '../data/rounds.json';
import { ROWS } from './constants.ts';
import type { PadSpec, Side } from './pads.ts';
import { LEVEL_COUNT, ROUNDS_PER_LEVEL } from './rules.ts';
import type { Stage } from './rules.ts';

/** Per-level timing, in frames at 60 Hz. Lower numbers = faster. */
export interface LevelSpeed {
  /** Hero hop duration. */
  readonly heroHop: number;
  /** Hop duration for every enemy (crawlers too: one step along the cube sides). */
  readonly enemyHop: number;
  readonly ballRest: number;
  readonly chaserRest: number;
  readonly eggHatch: number;
  readonly crawlerRest: number;
  readonly undoerRest: number;
  /** How long a freeze orb stops the enemies. */
  readonly freeze: number;
}

export const SPAWN_KINDS = ['ball', 'freezeOrb', 'crawlerLeft', 'crawlerRight', 'undoer'] as const;
export type SpawnKind = (typeof SPAWN_KINDS)[number];

export interface SpawnTable {
  /** Frames from round start (or a reset) to the first spawn. */
  readonly first: number;
  /** Frames between later spawn attempts. */
  readonly interval: number;
  readonly maxBalls: number;
  /** Whether the egg (→ Chaser) appears this round. */
  readonly egg: boolean;
  /** Relative odds of each kind when a spawn is not the egg; missing kinds never spawn. */
  readonly weights: Readonly<Partial<Record<SpawnKind, number>>>;
}

export interface RoundData {
  readonly round: number;
  readonly pads: readonly PadSpec[];
  readonly spawn: SpawnTable;
}

export interface LevelData {
  readonly level: number;
  /** Points per lift pad left unused when the round is cleared. */
  readonly padPoints: number;
  readonly speed: LevelSpeed;
  readonly rounds: readonly RoundData[];
}

const SPEED_KEYS: readonly (keyof LevelSpeed)[] = [
  'heroHop',
  'enemyHop',
  'ballRest',
  'chaserRest',
  'eggHatch',
  'crawlerRest',
  'undoerRest',
  'freeze',
];

class DataError extends Error {}

function fail(where: string, problem: string): never {
  throw new DataError(`rounds.json ${where}: ${problem}`);
}

function positiveInt(v: unknown, where: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) fail(where, `expected a positive integer, got ${String(v)}`);
  return v;
}

function record(v: unknown, where: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(where, 'expected an object');
  return v as Record<string, unknown>;
}

function list(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) fail(where, 'expected an array');
  return v;
}

function parsePads(v: unknown, where: string): PadSpec[] {
  const pads = list(v, where).map((p, i) => {
    const o = record(p, `${where}[${i}]`);
    const side: Side =
      o.side === 'left' || o.side === 'right' ? o.side : fail(`${where}[${i}].side`, 'expected "left" or "right"');
    const row = positiveInt(o.row, `${where}[${i}].row`);
    if (row >= ROWS) fail(`${where}[${i}].row`, `must be 1..${ROWS - 1}`);
    return { side, row };
  });
  const keys = pads.map((p) => `${p.side}${p.row}`);
  if (new Set(keys).size !== keys.length) fail(where, 'two pads in the same place');
  return pads;
}

function parseSpawn(v: unknown, where: string): SpawnTable {
  const o = record(v, where);
  const w = record(o.weights, `${where}.weights`);
  const weights: Partial<Record<SpawnKind, number>> = {};
  for (const [k, n] of Object.entries(w)) {
    if (!(SPAWN_KINDS as readonly string[]).includes(k)) fail(`${where}.weights.${k}`, 'unknown enemy kind');
    weights[k as SpawnKind] = positiveInt(n, `${where}.weights.${k}`);
  }
  if (typeof o.egg !== 'boolean') fail(`${where}.egg`, 'expected true or false');
  return {
    first: positiveInt(o.first, `${where}.first`),
    interval: positiveInt(o.interval, `${where}.interval`),
    maxBalls: positiveInt(o.maxBalls, `${where}.maxBalls`),
    egg: o.egg,
    weights,
  };
}

/** Validate raw round data; exported for tests. */
export function parseLevels(data: unknown): LevelData[] {
  const levels = list(record(data, '(root)').levels, 'levels');
  if (levels.length !== LEVEL_COUNT) fail('levels', `expected ${LEVEL_COUNT} levels, got ${levels.length}`);
  return levels.map((lv, li) => {
    const where = `levels[${li}]`;
    const o = record(lv, where);
    if (o.level !== li + 1) fail(`${where}.level`, `expected ${li + 1}`);
    const s = record(o.speed, `${where}.speed`);
    const speed = Object.fromEntries(SPEED_KEYS.map((k) => [k, positiveInt(s[k], `${where}.speed.${k}`)]));
    const rounds = list(o.rounds, `${where}.rounds`);
    if (rounds.length !== ROUNDS_PER_LEVEL) fail(`${where}.rounds`, `expected ${ROUNDS_PER_LEVEL} rounds`);
    return {
      level: li + 1,
      padPoints: positiveInt(o.padPoints, `${where}.padPoints`),
      speed: speed as unknown as LevelSpeed,
      rounds: rounds.map((r, ri) => {
        const rw = `${where}.rounds[${ri}]`;
        const ro = record(r, rw);
        if (ro.round !== ri + 1) fail(`${rw}.round`, `expected ${ri + 1}`);
        return { round: ri + 1, pads: parsePads(ro.pads, `${rw}.pads`), spawn: parseSpawn(ro.spawn, `${rw}.spawn`) };
      }),
    };
  });
}

export const LEVELS: readonly LevelData[] = parseLevels(raw);

export function levelData(level: number): LevelData {
  const data = LEVELS[level - 1];
  if (!data) throw new RangeError(`No level ${level}`);
  return data;
}

export function roundData(stage: Stage): RoundData {
  const data = levelData(stage.level).rounds[stage.round - 1];
  if (!data) throw new RangeError(`No round ${stage.round} in level ${stage.level}`);
  return data;
}
