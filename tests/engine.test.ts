import { describe, expect, it } from 'vitest';
import { DirectionInput } from '../src/engine/input.ts';
import { createLoop } from '../src/engine/loop.ts';
import type { FrameScheduler } from '../src/engine/loop.ts';
import { fitScale } from '../src/engine/screen.ts';

const noScheduler: FrameScheduler = { request: () => 1, cancel: () => {} };

function makeLoop(stepMs = 10, maxFrameMs = 100) {
  let updates = 0;
  let lastAlpha = -1;
  const loop = createLoop(
    {
      stepMs,
      maxFrameMs,
      update: () => {
        updates++;
      },
      render: (a) => {
        lastAlpha = a;
      },
    },
    noScheduler,
  );
  return { loop, updates: () => updates, alpha: () => lastAlpha };
}

describe('fixed-step loop', () => {
  it('runs whole steps and carries the remainder', () => {
    const t = makeLoop(10);
    expect(t.loop.tick(0)).toBe(0);
    expect(t.loop.tick(25)).toBe(2);
    expect(t.alpha()).toBeCloseTo(0.5);
    expect(t.loop.tick(30)).toBe(1);
    expect(t.updates()).toBe(3);
  });

  it('clamps long stalls', () => {
    const t = makeLoop(10, 100);
    t.loop.tick(0);
    expect(t.loop.tick(5000)).toBe(10);
  });

  it('ignores time going backwards', () => {
    const t = makeLoop(10);
    t.loop.tick(100);
    expect(t.loop.tick(50)).toBe(0);
  });

  it('start and stop toggle running', () => {
    const t = makeLoop();
    expect(t.loop.running).toBe(false);
    t.loop.start();
    expect(t.loop.running).toBe(true);
    t.loop.stop();
    expect(t.loop.running).toBe(false);
  });
});

describe('direction input', () => {
  it('maps arrows like a 45-degree rotated stick', () => {
    const input = new DirectionInput();
    const read = (code: string) => {
      input.keyDown(code);
      input.keyUp(code);
      return input.consume();
    };
    expect(read('ArrowUp')).toBe('upRight');
    expect(read('ArrowRight')).toBe('downRight');
    expect(read('ArrowDown')).toBe('downLeft');
    expect(read('ArrowLeft')).toBe('upLeft');
    expect(read('KeyQ')).toBe('upLeft');
    expect(read('Numpad3')).toBe('downRight');
  });

  it('reports unbound keys as unhandled', () => {
    const input = new DirectionInput();
    expect(input.keyDown('KeyX')).toBe(false);
    expect(input.consume()).toBeNull();
  });

  it('a quick tap is seen once even if released before the step', () => {
    const input = new DirectionInput();
    input.keyDown('ArrowUp');
    input.keyUp('ArrowUp');
    expect(input.consume()).toBe('upRight');
    expect(input.consume()).toBeNull();
  });

  it('a held key repeats; the most recent held key wins', () => {
    const input = new DirectionInput();
    input.keyDown('KeyA');
    input.consume();
    expect(input.consume()).toBe('downLeft');
    input.keyDown('KeyD');
    input.consume();
    expect(input.consume()).toBe('downRight');
    input.keyUp('KeyD');
    expect(input.consume()).toBe('downLeft');
    input.reset();
    expect(input.consume()).toBeNull();
  });
});

describe('screen scaling', () => {
  const logical = { width: 256, height: 240 };
  it('uses the largest integer scale that fits', () => {
    expect(fitScale(logical, { width: 1920, height: 1080 })).toBe(4);
    expect(fitScale(logical, { width: 800, height: 600 })).toBe(2);
  });
  it('shrinks fractionally on very small viewports', () => {
    expect(fitScale(logical, { width: 128, height: 600 })).toBeCloseTo(0.5);
  });
});
