// Screen and timing constants. Timing values are placeholders until docs/TIMING.md is measured.

/** Logical screen size in pixels (matches the 1982 hardware). */
export const SCREEN_W = 256;
export const SCREEN_H = 240;

/** Simulation rate. */
export const STEP_HZ = 60;
export const STEP_MS = 1000 / STEP_HZ;
/** Longest frame delta the loop will simulate; anything longer is treated as a stall. */
export const MAX_FRAME_MS = 250;

/** Pyramid geometry. */
export const ROWS = 7;
export const CUBE_W = 32; // width of a cube (and of its top face)
export const CUBE_TOP_H = 16; // height of the top-face diamond
export const CUBE_SIDE_H = 16; // height of each side face
export const ROW_STEP_Y = CUBE_TOP_H / 2 + CUBE_SIDE_H; // 24 px between rows
/** Screen position of the centre of the apex cube's top face. */
export const APEX_X = SCREEN_W / 2;
export const APEX_Y = 40;

/** Hero timing (frames at 60 Hz). See docs/TIMING.md. */
export const HOP_FRAMES = 18;
export const HOP_HEIGHT = 12;
export const FALL_FRAMES = 60;
export const RESPAWN_DELAY_FRAMES = 45;
export const INPUT_BUFFER_FRAMES = 6;
/** Downward acceleration while falling, px/frame², tuned so a fall clears the screen in FALL_FRAMES. */
export const FALL_GRAVITY = (2 * SCREEN_H) / (FALL_FRAMES * FALL_FRAMES);

/** Sequence timing (frames at 60 Hz). Placeholders; see docs/TIMING.md "Sequences". */
export const DEMO_START_FRAMES = 30; // level title shown before the demo hops
export const DEMO_HOP_PAUSE_FRAMES = 10; // idle pause between demo hops
export const DEMO_END_FRAMES = 45; // hold on the finished demo before the round starts
export const ROUND_FLASH_FRAMES = 120; // round-complete flash before the next round
export const ROUND_FLASH_PERIOD = 8; // frames per color in the flash
