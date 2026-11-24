// Logical-resolution canvas, scaled to fit the window with crisp pixels.

export interface ScreenSize {
  width: number;
  height: number;
}

/**
 * Largest scale that fits the logical screen in the viewport. Integer when at least 1×
 * fits (pixel-perfect); otherwise a fractional shrink so small phones still see everything.
 */
export function fitScale(logical: ScreenSize, viewport: ScreenSize): number {
  const raw = Math.min(viewport.width / logical.width, viewport.height / logical.height);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return raw >= 1 ? Math.floor(raw) : raw;
}

export function setupScreen(canvas: HTMLCanvasElement, logical: ScreenSize): CanvasRenderingContext2D {
  canvas.width = logical.width;
  canvas.height = logical.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.imageSmoothingEnabled = false;

  const resize = (): void => {
    const s = fitScale(logical, { width: window.innerWidth, height: window.innerHeight });
    canvas.style.width = `${logical.width * s}px`;
    canvas.style.height = `${logical.height * s}px`;
  };
  resize();
  window.addEventListener('resize', resize);
  return ctx;
}
