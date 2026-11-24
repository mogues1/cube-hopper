import { describe, expect, it } from 'vitest';
import {
  FALL_FRAMES,
  HOP_FRAMES,
  INPUT_BUFFER_FRAMES,
  RESPAWN_DELAY_FRAMES,
  SCREEN_H,
} from '../src/game/constants.ts';
import { createHero, heroPose, updateHero } from '../src/game/hero.ts';
import type { Hero, HeroEvent } from '../src/game/hero.ts';
import type { Dir } from '../src/game/pyramid.ts';

function run(hero: Hero, frames: number, input: Dir | null = null): HeroEvent[] {
  const events: HeroEvent[] = [];
  for (let i = 0; i < frames; i++) events.push(...updateHero(hero, input));
  return events;
}

describe('hero hopping', () => {
  it('starts idle on the apex', () => {
    const hero = createHero();
    expect(hero.state.kind).toBe('idle');
    expect(hero.cell).toEqual({ row: 0, col: 0 });
  });

  it('a press starts a hop that lands on the neighbour after HOP_FRAMES', () => {
    const hero = createHero();
    expect(updateHero(hero, 'downRight')).toEqual(['hopStart']);
    expect(hero.facing).toBe('downRight');
    const events = run(hero, HOP_FRAMES - 1);
    expect(events).toEqual([]);
    expect(updateHero(hero, null)).toEqual(['landed']);
    expect(hero.cell).toEqual({ row: 1, col: 1 });
    expect(hero.state.kind).toBe('idle');
  });

  it('a held direction hops continuously with no idle gap', () => {
    const hero = createHero();
    const events = run(hero, HOP_FRAMES * 3, 'downLeft');
    expect(events.filter((e) => e === 'landed')).toHaveLength(2);
    expect(events.filter((e) => e === 'hopStart')).toHaveLength(3);
    expect(hero.cell).toEqual({ row: 2, col: 0 });
  });

  it('buffers a press made shortly before landing', () => {
    const hero = createHero();
    updateHero(hero, 'downRight');
    run(hero, HOP_FRAMES - 4);
    updateHero(hero, 'downLeft'); // pressed 3 frames before landing
    const events = run(hero, 3);
    expect(events).toContain('landed');
    expect(events).toContain('hopStart');
    expect(hero.facing).toBe('downLeft');
  });

  it('drops a buffered press that is too old', () => {
    const hero = createHero();
    updateHero(hero, 'downRight');
    updateHero(hero, 'downLeft'); // pressed at the very start of the hop
    const events = run(hero, HOP_FRAMES);
    expect(HOP_FRAMES).toBeGreaterThan(INPUT_BUFFER_FRAMES + 2);
    expect(events).toEqual(['landed']);
  });

  it('arcs above the straight line mid-hop', () => {
    const hero = createHero();
    updateHero(hero, 'downRight');
    run(hero, HOP_FRAMES / 2 - 1);
    const mid = heroPose(hero);
    // Straight-line midpoint between apex (y=40) and row 1 (y=64) is 52.
    expect(mid.y).toBeLessThan(52);
  });
});

describe('falling off', () => {
  it('hopping off a back edge falls behind, then respawns on the apex', () => {
    const hero = createHero();
    updateHero(hero, 'upLeft');
    const events = run(hero, HOP_FRAMES);
    expect(events).toEqual(['fellOff']);
    expect(hero.state.kind).toBe('falling');
    expect(heroPose(hero).behind).toBe(true);

    run(hero, FALL_FRAMES);
    expect(hero.state.kind).toBe('respawning');
    expect(heroPose(hero).visible).toBe(false);

    const back = run(hero, RESPAWN_DELAY_FRAMES);
    expect(back).toEqual(['respawned']);
    expect(hero.cell).toEqual({ row: 0, col: 0 });
    expect(hero.state.kind).toBe('idle');
  });

  it('falling off the bottom row is drawn in front and leaves the screen', () => {
    const hero = createHero();
    // Hold down-left: six hops reach row 6, and the held key immediately starts a seventh.
    run(hero, HOP_FRAMES * 6 + 1, 'downLeft');
    expect(hero.cell).toEqual({ row: 6, col: 0 });
    expect(hero.state.kind).toBe('hopping');
    run(hero, HOP_FRAMES);
    expect(hero.state.kind).toBe('falling');
    expect(heroPose(hero).behind).toBe(false);
    run(hero, FALL_FRAMES - 1);
    expect(heroPose(hero).y).toBeGreaterThan(SCREEN_H);
  });

  it('ignores input while falling', () => {
    const hero = createHero();
    updateHero(hero, 'upRight');
    run(hero, HOP_FRAMES);
    const events = run(hero, FALL_FRAMES + RESPAWN_DELAY_FRAMES, 'downRight');
    expect(events).toEqual(['respawned']);
    expect(hero.state.kind).toBe('idle');
  });
});
