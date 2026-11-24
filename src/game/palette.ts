// The game's full color set. Keep it at 16 entries or fewer (tests enforce this).
// Original palette; see docs/IP.md.

export const PALETTE = {
  background: '#0d0f1f',
  cubeTopStart: '#d9c15a',
  cubeTopIntermediate: '#5fb0e8',
  cubeTopGoal: '#e86fa0',
  cubeLeft: '#b5483a',
  cubeRight: '#6b2a35',
  cubeEdge: '#2a1420',
  pipBody: '#2bb5a0',
  pipHighlight: '#8ff0dc',
  pipOutline: '#12333a',
  pipEyeWhite: '#f4f4ec',
  pipFeet: '#f0a030',
  pipSprout: '#6cc04a',
  text: '#f4f4ec',
} as const;

export type PaletteName = keyof typeof PALETTE;
