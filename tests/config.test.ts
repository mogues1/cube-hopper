import { describe, expect, it } from 'vitest';
import timingSheet from '../docs/TIMING.md?raw';
import raw from '../src/data/rounds.json';
import { LEVELS, levelData, parseLevels, roundData, SPAWN_KINDS } from '../src/game/config.ts';
import type { LevelSpeed, SpawnKind, SpawnTable } from '../src/game/config.ts';
import { HOP_FRAMES } from '../src/game/constants.ts';
import { padCell } from '../src/game/pads.ts';
import { isOnPyramid } from '../src/game/pyramid.ts';

const clone = (): { levels: Record<string, unknown>[] } => JSON.parse(JSON.stringify(raw));

describe('round data', () => {
  it('has 9 levels of 4 rounds', () => {
    expect(LEVELS).toHaveLength(9);
    for (const level of LEVELS) expect(level.rounds).toHaveLength(4);
    expect(() => levelData(10)).toThrow(RangeError);
    expect(() => roundData({ level: 1, round: 5 })).toThrow(RangeError);
  });

  it('every round has 2–6 lift pads, all off the pyramid and in distinct places', () => {
    for (const level of LEVELS) {
      for (const round of level.rounds) {
        expect(round.pads.length).toBeGreaterThanOrEqual(2);
        expect(round.pads.length).toBeLessThanOrEqual(6);
        const cells = round.pads.map(padCell);
        for (const c of cells) expect(isOnPyramid(c)).toBe(false);
        expect(new Set(cells.map((c) => `${c.row},${c.col}`)).size).toBe(cells.length);
      }
    }
  });

  it('level 1 hero hop matches HOP_FRAMES', () => {
    expect(levelData(1).speed.heroHop).toBe(HOP_FRAMES);
  });

  it('speed curve: nothing gets slower as levels rise, and level 9 is faster than level 1', () => {
    const keys = Object.keys(levelData(1).speed) as (keyof LevelSpeed)[];
    for (const key of keys) {
      for (let level = 2; level <= 9; level++) {
        expect(levelData(level).speed[key], `${key} at level ${level}`).toBeLessThanOrEqual(
          levelData(level - 1).speed[key],
        );
      }
      expect(levelData(9).speed[key], key).toBeLessThan(levelData(1).speed[key]);
    }
  });

  it('spawns come faster round by round, and each level starts no easier than the last', () => {
    // A new level eases off a little from the previous round 4, while its hops get faster.
    for (const level of LEVELS) {
      const intervals = level.rounds.map((r) => r.spawn.interval);
      for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeLessThanOrEqual(intervals[i - 1]!);
    }
    for (let level = 2; level <= 9; level++) {
      expect(roundData({ level, round: 1 }).spawn.interval).toBeLessThanOrEqual(
        roundData({ level: level - 1, round: 1 }).spawn.interval,
      );
    }
  });

  it('level 1 introduces the cast one round at a time, then every level has all of it', () => {
    const kinds = (t: SpawnTable): SpawnKind[] => SPAWN_KINDS.filter((k) => (t.weights[k] ?? 0) > 0);
    const l1 = levelData(1).rounds.map((r) => kinds(r.spawn));
    expect(l1[0]).toEqual(['ball']);
    expect(l1[1]).toEqual(['ball', 'freezeOrb']);
    expect(l1[2]).toEqual(['ball', 'freezeOrb', 'crawlerLeft', 'crawlerRight']);
    expect(l1[3]).toEqual([...SPAWN_KINDS]);
    for (const level of LEVELS.slice(1)) {
      for (const round of level.rounds) expect(kinds(round.spawn)).toEqual([...SPAWN_KINDS]);
    }
    for (const level of LEVELS) for (const round of level.rounds) expect(round.spawn.egg).toBe(true);
  });
});

describe('round data validation', () => {
  it('accepts the shipped file', () => {
    expect(parseLevels(raw)).toHaveLength(9);
  });

  it('rejects bad edits with a message saying where', () => {
    const missingSpeed = clone();
    delete (missingSpeed.levels[2]!.speed as Record<string, unknown>).chaserRest;
    expect(() => parseLevels(missingSpeed)).toThrow('levels[2].speed.chaserRest');

    const badPad = clone();
    (badPad.levels[0]!.rounds as { pads: { row: number }[] }[])[1]!.pads[0]!.row = 7;
    expect(() => parseLevels(badPad)).toThrow('levels[0].rounds[1].pads[0].row');

    const typo = clone();
    (typo.levels[4]!.rounds as { spawn: { weights: Record<string, number> } }[])[0]!.spawn.weights.balls = 2;
    expect(() => parseLevels(typo)).toThrow('unknown enemy kind');

    const short = clone();
    short.levels.pop();
    expect(() => parseLevels(short)).toThrow('expected 9 levels');
  });
});

/**
 * Exit criterion for M4: the data matches the timing sheet within 10%. Every row of
 * docs/TIMING.md whose "Used in" names a rounds.json key is checked against level 1 round 1,
 * using the Measured column once it holds a number and the Placeholder until then.
 */
describe('timing sheet', () => {
  const rows = timingSheet
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split('|').map((cell) => cell.trim()));
  const keyed = rows
    .map((cells) => {
      const usedIn = cells[5] ?? '';
      const m = /rounds\.json (speed|spawn)\.(\w+)/.exec(usedIn);
      if (!m) return null;
      const leading = (s: string | undefined): number | null => {
        const n = /^\d+(\.\d+)?/.exec(s ?? '');
        return n ? Number(n[0]) : null;
      };
      return {
        label: cells[1] ?? '',
        group: m[1] as 'speed' | 'spawn',
        key: m[2] ?? '',
        expected: leading(cells[3]) ?? leading(cells[2]),
      };
    })
    .filter((r) => r !== null);

  it('names a rounds.json key on the expected rows', () => {
    expect(keyed.length).toBeGreaterThanOrEqual(10);
  });

  for (const row of keyed) {
    it(`${row.label} is within 10% of the sheet`, () => {
      const data =
        row.group === 'speed'
          ? (levelData(1).speed as unknown as Record<string, number>)[row.key]
          : (roundData({ level: 1, round: 1 }).spawn as unknown as Record<string, number>)[row.key];
      expect(data, `rounds.json ${row.group}.${row.key}`).toBeTypeOf('number');
      expect(row.expected, `sheet value for ${row.label}`).not.toBeNull();
      const want = row.expected ?? 0;
      expect(Math.abs((data ?? 0) - want)).toBeLessThanOrEqual(want * 0.1);
    });
  }
});
