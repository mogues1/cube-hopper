import { attachKeyboard, DirectionInput } from './engine/input.ts';
import { browserScheduler, createLoop } from './engine/loop.ts';
import { setupScreen } from './engine/screen.ts';
import { MAX_FRAME_MS, SCREEN_H, SCREEN_W, STEP_MS } from './game/constants.ts';
import { createGame, updateGame } from './game/game.ts';
import { renderFrame } from './game/render.ts';
import { LEVEL_COUNT } from './game/rules.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
if (!canvas) throw new Error('#screen canvas missing');

const ctx = setupScreen(canvas, { width: SCREEN_W, height: SCREEN_H });
// The controls hint is pinned under the canvas; hide it when the canvas leaves no room,
// so it never covers the in-game captions at the bottom of the screen.
const hint = document.querySelector<HTMLElement>('.hint');
const HINT_ROOM_PX = 28;
const placeHint = (): void => {
  if (!hint) return;
  const below = (window.innerHeight - canvas.getBoundingClientRect().height) / 2;
  hint.hidden = below < HINT_ROOM_PX;
};
placeHint();
window.addEventListener('resize', placeHint);

const input = new DirectionInput();
attachKeyboard(window, input);

// Dev/playtest shortcut: ?level=N starts at level N (1–9), round 1.
const startLevel = Number(new URLSearchParams(window.location.search).get('level'));
const game = createGame(
  Number.isInteger(startLevel) && startLevel >= 1 && startLevel <= LEVEL_COUNT
    ? { level: startLevel, round: 1 }
    : undefined,
);

const loop = createLoop(
  {
    stepMs: STEP_MS,
    maxFrameMs: MAX_FRAME_MS,
    update: () => {
      const { pressed, held } = input.poll();
      updateGame(game, pressed, held);
    },
    render: () => renderFrame(ctx, game),
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
