// A 3 × 5 pixel font for the HUD. Original glyphs; '#' is ink, '.' is blank.

export const GLYPH_W = 3;
export const GLYPH_H = 5;
/** Horizontal advance per character, including 1 px spacing. */
export const GLYPH_ADVANCE = GLYPH_W + 1;

const G = (s: string): readonly string[] => s.split(' ');

export const FONT: Readonly<Record<string, readonly string[]>> = {
  '0': G('### #.# #.# #.# ###'),
  '1': G('.#. ##. .#. .#. ###'),
  '2': G('### ..# ### #.. ###'),
  '3': G('### ..# .## ..# ###'),
  '4': G('#.# #.# ### ..# ..#'),
  '5': G('### #.. ### ..# ###'),
  '6': G('### #.. ### #.# ###'),
  '7': G('### ..# ..# .#. .#.'),
  '8': G('### #.# ### #.# ###'),
  '9': G('### #.# ### ..# ###'),
  A: G('.#. #.# ### #.# #.#'),
  B: G('##. #.# ##. #.# ##.'),
  C: G('.## #.. #.. #.. .##'),
  D: G('##. #.# #.# #.# ##.'),
  E: G('### #.. ##. #.. ###'),
  F: G('### #.. ##. #.. #..'),
  G: G('.## #.. #.# #.# .##'),
  H: G('#.# #.# ### #.# #.#'),
  I: G('### .#. .#. .#. ###'),
  J: G('..# ..# ..# #.# .#.'),
  K: G('#.# #.# ##. #.# #.#'),
  L: G('#.. #.. #.. #.. ###'),
  M: G('#.# ### ### #.# #.#'),
  N: G('##. #.# #.# #.# #.#'),
  O: G('.#. #.# #.# #.# .#.'),
  P: G('##. #.# ##. #.. #..'),
  Q: G('.#. #.# #.# ##. .##'),
  R: G('##. #.# ##. #.# #.#'),
  S: G('.## #.. .#. ..# ##.'),
  T: G('### .#. .#. .#. .#.'),
  U: G('#.# #.# #.# #.# ###'),
  V: G('#.# #.# #.# #.# .#.'),
  W: G('#.# #.# ### ### #.#'),
  X: G('#.# #.# .#. #.# #.#'),
  Y: G('#.# #.# .#. .#. .#.'),
  Z: G('### ..# .#. #.. ###'),
  ' ': G('... ... ... ... ...'),
  '>': G('#.. .#. ..# .#. #..'),
  '-': G('... ... ### ... ...'),
  ':': G('... .#. ... .#. ...'),
  '!': G('.#. .#. .#. ... .#.'),
};

export function textWidth(text: string): number {
  return text.length === 0 ? 0 : text.length * GLYPH_ADVANCE - 1;
}

/** Calls `plot(x, y)` for every ink pixel of `text` drawn with its top-left at (x, y). */
export function rasterizeText(text: string, x: number, y: number, plot: (x: number, y: number) => void): void {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch] ?? FONT[' '];
    glyph?.forEach((row, gy) => {
      for (let gx = 0; gx < row.length; gx++) if (row[gx] === '#') plot(cx + gx, y + gy);
    });
    cx += GLYPH_ADVANCE;
  }
}
