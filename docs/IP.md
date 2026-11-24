# IP rules

Cube Hopper recreates game *rules and mechanics*, which are not protected by copyright. The original game's name, characters, artwork, sound, speech and code belong to their rights holder (Sony Pictures, via Columbia Pictures, which owned Gottlieb in 1982). None of that goes in this repository.

## Allowed

- Pyramid of 28 cubes, diagonal hopping, cube color-change rules, enemy *behaviors*, scoring values, level/round structure.
- Our own names, characters, sprites, palettes, sound effects, music and voice babble, made from scratch.
- Referring to the original by name in docs, only to describe behavior we are matching.

## Not allowed

- ROM files, disassembly, or code ported from the original or any official port.
- Sprites, tiles, sounds or speech ripped or traced from the original or any port.
- The original title, character names, or look-alike character designs (an orange long-nosed hero, a purple coiled snake, etc.) in the game itself.
- The original's cursing speech balloon or its symbol string.
- Marketing that implies the game is official or licensed.

## Working names

| Behavior reference | Cube Hopper name |
| --- | --- |
| Player character | **Pip** |
| Red ball | Hazard ball |
| Purple ball / snake | Chaser (egg → Chaser) |
| Green ball | Freeze orb |
| Side-walking enemies | Side crawlers |
| Cube-reverting creatures | Undoers |
| Escape discs | Lift pads |

## Licensing track

If we later license the real IP from Sony Pictures Consumer Products, assets live behind `src/game/sprites.ts`, `src/game/palette.ts` and (from M5) the audio module, so they can be swapped without touching game logic.

Before public release (M8): legal review of names, art and store/marketing copy.
