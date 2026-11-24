// Fixed-timestep game loop: simulation advances in exact steps, rendering runs once per display frame.

export interface LoopOptions {
  stepMs: number;
  /** Frame deltas above this are clamped (tab switches, debugger pauses). */
  maxFrameMs: number;
  update(): void;
  /** alpha = fraction of a step left over, for optional interpolation. */
  render(alpha: number): void;
}

export interface FrameScheduler {
  request(cb: (timeMs: number) => void): number;
  cancel(id: number): void;
}

export interface Loop {
  start(): void;
  stop(): void;
  readonly running: boolean;
  /** Advance to time `nowMs`; returns the number of simulation steps run. Exposed for tests. */
  tick(nowMs: number): number;
}

export function createLoop(opts: LoopOptions, scheduler: FrameScheduler): Loop {
  let last: number | null = null;
  let acc = 0;
  let frameId: number | null = null;

  const tick = (nowMs: number): number => {
    if (last === null) last = nowMs;
    const delta = Math.min(Math.max(nowMs - last, 0), opts.maxFrameMs);
    last = nowMs;
    acc += delta;
    let steps = 0;
    while (acc >= opts.stepMs) {
      opts.update();
      acc -= opts.stepMs;
      steps++;
    }
    opts.render(acc / opts.stepMs);
    return steps;
  };

  const frame = (t: number): void => {
    tick(t);
    frameId = scheduler.request(frame);
  };

  return {
    start() {
      if (frameId !== null) return;
      last = null;
      acc = 0;
      frameId = scheduler.request(frame);
    },
    stop() {
      if (frameId === null) return;
      scheduler.cancel(frameId);
      frameId = null;
    },
    get running() {
      return frameId !== null;
    },
    tick,
  };
}

export const browserScheduler: FrameScheduler = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};
