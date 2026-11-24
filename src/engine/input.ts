import type { Dir } from '../game/pyramid.ts';

/**
 * Key codes → hop direction. Arrow keys follow the original's joystick, which was
 * mounted rotated 45°: up = up-right, right = down-right, down = down-left, left = up-left.
 */
export const KEY_BINDINGS: Readonly<Record<string, Dir>> = {
  ArrowUp: 'upRight',
  ArrowRight: 'downRight',
  ArrowDown: 'downLeft',
  ArrowLeft: 'upLeft',
  KeyQ: 'upLeft',
  KeyE: 'upRight',
  KeyA: 'downLeft',
  KeyD: 'downRight',
  Numpad7: 'upLeft',
  Numpad9: 'upRight',
  Numpad1: 'downLeft',
  Numpad3: 'downRight',
};

/** Tracks held directions and fresh presses; the game reads one direction per step. */
export class DirectionInput {
  private held: Dir[] = [];
  private pressed: Dir | null = null;
  private bindings: Readonly<Record<string, Dir>>;

  constructor(bindings: Readonly<Record<string, Dir>> = KEY_BINDINGS) {
    this.bindings = bindings;
  }

  /** Returns true if the key is bound (caller should preventDefault). */
  keyDown(code: string, repeat = false): boolean {
    const dir = this.bindings[code];
    if (!dir) return false;
    if (!repeat) {
      this.pressed = dir;
      this.held = this.held.filter((d) => d !== dir);
      this.held.push(dir);
    }
    return true;
  }

  keyUp(code: string): boolean {
    const dir = this.bindings[code];
    if (!dir) return false;
    this.held = this.held.filter((d) => d !== dir);
    return true;
  }

  /** Clear everything (e.g. on window blur, so keys are not stuck down). */
  reset(): void {
    this.held = [];
    this.pressed = null;
  }

  /** Direction for this step: a fresh press wins, else the most recently held key. */
  consume(): Dir | null {
    const dir = this.pressed ?? this.held.at(-1) ?? null;
    this.pressed = null;
    return dir;
  }
}

export function attachKeyboard(target: Window, input: DirectionInput): () => void {
  const down = (e: KeyboardEvent): void => {
    if (input.keyDown(e.code, e.repeat)) e.preventDefault();
  };
  const up = (e: KeyboardEvent): void => {
    if (input.keyUp(e.code)) e.preventDefault();
  };
  const blur = (): void => input.reset();
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', blur);
  return () => {
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
    target.removeEventListener('blur', blur);
  };
}
