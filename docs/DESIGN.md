# Design spec

**One line:** hop diagonally around a 7-row pyramid of 28 cubes, change every cube top to the goal color, and dodge things bouncing down after you.

## Screen

- Logical resolution 256 × 240, portrait-friendly, integer-scaled and letterboxed.
- Fixed 60 Hz simulation (the original refreshed at about 61.4 Hz; the difference is not perceptible).
- 16-color palette maximum (`src/game/palette.ts`).
- Pyramid apex centered at x = 128, top-face center y = 40; each row is 24 px lower and each cube 32 px wide, so the bottom row's base sits at y = 208.

```
row 0            [0]
row 1          [0][1]
row 2        [0][1][2]
 ...
row 6  [0][1][2][3][4][5][6]
```

Cell (row, col) with 0 ≤ col ≤ row ≤ 6. Diagonal moves:

| Hop | Δrow | Δcol |
| --- | --- | --- |
| Up-left | −1 | −1 |
| Up-right | −1 | 0 |
| Down-left | +1 | 0 |
| Down-right | +1 | +1 |

Any hop that lands outside that triangle is a fall. Falls off the back edges (any target row < 7) are drawn behind the pyramid; falls off the bottom row are drawn in front.

## Controls

The original used one 4-way joystick mounted at 45°, so every stick direction is a diagonal hop. We keep that mapping on the arrow keys and add direct diagonal keys:

| Hop | Arrow | Letter | Numpad |
| --- | --- | --- | --- |
| Up-right | ↑ | E | 9 |
| Down-right | → | D | 3 |
| Down-left | ↓ | A | 1 |
| Up-left | ← | Q | 7 |

Holding a direction keeps hopping. A press during the last frames of a hop is buffered (6 frames) so quick players are not dropped. Touch and gamepad arrive in M7.

## Characters (original designs)

| Name | Role | Look |
| --- | --- | --- |
| **Pip** | Player | Round teal blob, one large eye, small green sprout on top, orange feet. Shows its back (no eye) when hopping upward. |
| Hazard ball | Kills on contact | Glossy crimson sphere with a single highlight. |
| Chaser | Main pursuer | Starts as a speckled violet egg; hatches into a lanky violet chameleon-like lizard with a curled tail. |
| Freeze orb | Freezes enemies | Pale ice-blue orb with a snowflake glint. |
| Side crawlers | Walk on cube sides | Two beetle-like bugs, one walking on left faces, one on right faces. |
| Undoers | Revert cubes, harmless | Two small paint-roller gremlins carrying the start color. |
| Lift pads | Escape to top | Spinning hexagonal pads in rotating colors. |

All designs are new; see [IP.md](IP.md) for what we may not copy.

## Rules summary

Taken from the original game's published rules; see the plan doc for the full tables.

- 9 levels × 4 rounds; level 9's last round repeats forever.
- Color rules: L1 S→D · L2 S→I→D · L3 S↔D toggles · L4 S→I→D, D→I · L5–9 S→I→D, D→S.
- Scoring: 15 intermediate, 25 destination, 100 freeze orb, 300 Undoer, 500 Chaser lured off, 50/100 per unused lift pad, round bonus 1,000 + 250 per round.
- Cube points are for progress only: a cube that stays finished or is knocked back (L3–9) scores nothing, and scores again when re-finished.
- The hero starts each round on the apex without coloring it; only landings change cubes. A fall keeps the board as it was.
- Level demo: before round 1 of each level, Pip hops apex ↔ the cube below-left three times each way (6 hops), so the player sees every step of that level's rule, including what hopping a finished cube does. The original showed 4 hops; 6 are needed to show the revert on levels 4–9. Demo hops never score, and input is ignored.
- HUD: score (top left), goal color sequence under it, level and round (top right); "LEVEL n" caption during the demo and "BONUS n" during the round-complete flash.
- HUD lives: small Pip heads under the goal colors, one per reserve life (the life in play is Pip on the pyramid).
- Extra lives at 8,000 and every 14,000 after; start with 3 (configurable).

## Hazards, lift pads and lives (M3)

- **Spawning:** every enemy drops in from above onto one of the two cubes under the apex. The first spawn of a round is a hazard ball; after that an egg comes whenever no egg or Chaser is out, otherwise another ball (at most 2 on level 1). Spawn timing and bounces use a seeded random generator, so a seed replays exactly.
- **Hazard ball:** bounces down-left or down-right at random each hop and falls off the bottom.
- **Egg → Chaser:** bounces down like a ball, waits on the bottom row, then hatches. The Chaser hops to whichever neighbor is fewest hops from Pip (ties: straight-line distance), so every hop gets it one hop closer. It never hops off the pyramid on its own. Only one egg or Chaser at a time.
- **Collisions:** Pip is caught only when its sprite visibly touches an enemy's: a drawn pixel of one overlaps, or is right next to, a drawn pixel of the other, using exactly the sprites and positions on screen (`src/game/collide.ts`). They must also share a cube (one Pip is on or hopping between, and one the enemy is on, hopping between or dropping onto), so sprites that only overlap because the isometric view stacks neighboring cubes do not count. A dropping enemy catches Pip when it reaches Pip, before it lands.
- **Caught:** everything freezes for 90 frames while Pip blinks, then a life is lost, all enemies are cleared, and Pip carries on from the cube where it was caught. (The original's cursing speech balloon is off limits; see [IP.md](IP.md).)
- **Falling off:** costs a life and clears the enemies; Pip respawns on the apex. No enemies move or spawn until it is back.
- **Lift pads:** 2 per round (placeholder layouts until the M4 tables), beside an edge cube, one up-and-outward hop away. Hopping onto one rides it to above the apex, then Pip drops onto the apex, which counts as a landing. No spawns during the ride; on arrival all enemies are cleared.
- **Luring the Chaser:** while Pip rides, the Chaser heads for the cube Pip left from and hops off the same way, for 500. It has to be close behind to make it before the ride ends.
- **Unused pads** at round end: 50 each on level 1, 100 after (placeholder; sources only say "50, later 100"). The round-complete bonus caption includes them.
- **Lives:** start with 3; extra life at 8,000 and every 14,000 after. When the last is lost the game shows GAME OVER; after 1 second any key starts a new game (attract mode and high scores come in M6).

## Full cast, data and speed (M4)

- **Freeze orb:** bounces down like a hazard ball. Catching it scores 100 and freezes every other enemy for the level's freeze time (300 frames on level 1); nothing spawns meanwhile, and frozen enemies blink for the last second. Frozen enemies are still deadly to touch (our choice; sources only say they are frozen).
- **Side crawlers:** two green beetles. One enters at the bottom-left corner and walks the cubes' left faces, stepping right or up-right at random; the other mirrors it on the right faces from the bottom-right. Each leaves the pyramid past the far edge. A crawler clings to the top rim of the face, so it visibly reaches the feet of Pip standing on that cube, and catches it. At most one per side at a time.
- **Undoers:** an orange gremlin with a paint roller. It bounces down like a ball and turns every cube it lands on back to the start color. Catching it scores 300 and costs no life. At most one at a time.
- **First appearances:** level 1 adds one kind per round: round 1 hazard balls and the egg, round 2 the freeze orb, round 3 the side crawlers, round 4 the Undoer. From level 2 everything can appear.
- **Spawning:** the first spawn of a round is a hazard ball, then the egg whenever no egg or Chaser is out, otherwise a weighted random pick among kinds under their cap.
- **Data:** per-level speeds and per-round pads and spawn tables live in `src/data/rounds.json`, checked at load (`src/game/config.ts`) so a bad edit fails with the exact field named. Every hop, rest and hatch time gets shorter as levels rise; spawns come faster round by round, and each level starts no easier than the previous level's first round. Lift pads: 2 per round on levels 1–2, 3 on 3–5, 4 on 6–9.

## Out of scope for v1

Bonus/minigame rounds, level editor, online leaderboards, cocktail-cabinet screen flip.
