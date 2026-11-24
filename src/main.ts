import { attachKeyboard, DirectionInput } from './engine/input.ts';
import { browserScheduler, createLoop } from './engine/loop.ts';
import { setupScreen } from './engine/screen.ts';
import { MAX_FRAME_MS, SCREEN_H, SCREEN_W, STEP_MS } from './game/constants.ts';
import { createHero, updateHero } from './game/hero.ts';
import { renderFrame } from './game/render.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
if (!canvas) throw new Error('#screen canvas missing');

const ctx = setupScreen(canvas, { width: SCREEN_W, height: SCREEN_H });
const input = new DirectionInput();
attachKeyboard(window, input);

const hero = createHero();

const loop = createLoop(
  {
    stepMs: STEP_MS,
    maxFrameMs: MAX_FRAME_MS,
    update: () => {
      updateHero(hero, input.consume());
    },
    render: () => renderFrame(ctx, hero),
  },
  browserScheduler,
);

// Pause when the tab is hidden so background timer throttling cannot cause unfair deaths.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    loop.stop();
    input.reset();
  } else {
    loop.start();
  }
});

loop.start();
