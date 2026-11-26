# Development plan

Living version (with diagram and comments): https://claude.ai/artifact/AACGjU9Co3uDPea3aXNtfk

Nine milestones over 16 weeks, one full-time developer, art and audio part time from M5. Level 1 is playable end to end at week 7; all 36 rounds at week 9.

| # | Milestone | Weeks | Exit criteria |
| --- | --- | --- | --- |
| M0 | Pre-production: IP decision, character concepts, timing sheet, repo/CI/deploy | 1 | Design spec, timing sheet, pipeline deploys a page |
| M1 | Core engine: fixed-step loop, canvas scaling, isometric pyramid, hero hops with arc, death on hopping off | 2–3 | Hero hops all 28 cubes at a steady 60 fps on desktop and phone |
| M2 | Rules and progression: 5 color rules, round complete, 9 levels × 4 rounds, level demo, cube scoring, round bonus | 4 | Unit tests for every rule; empty pyramid clearable through level 9 |
| M3 | Hazards and Chaser: hazard balls, egg → Chaser AI, lift pads, death/respawn sequence, lives, game over | 5–7 | Level 1 playable and losable; Chaser lured off a pad for 500 |
| M4 | Full cast and difficulty: freeze orb, side crawlers, Undoers, JSON spawn tables, speed curve | 8–9 | All 36 rounds playable; data within 10% of timing sheet |
| M5 | Art and audio: final 16-color sprites, palettes per round, synth SFX, jingles, babble voices | 10–11 | No placeholders; assets under 1 MB |
| M6 | Game shell: attract mode, title, HUD, 2-player alternating, high scores, pause, settings | 12 | Attract → play → high-score entry without reload |
| M7 | Platforms and polish: touch, gamepad, PWA offline, reduced flash, color-blind palettes | 13–14 | Playwright smoke tests green on Chromium/Firefox/WebKit; offline on iOS/Android |
| M8 | Tuning and release: balance vs timing sheet, 5+ playtesters, bug bash, launch | 15–16 | No open crash/progression bugs; release deployed |

## M0 deliverables (this repo)

- [x] IP decision: original assets and names, see [IP.md](IP.md)
- [x] Design spec: [DESIGN.md](DESIGN.md)
- [x] Reference timing sheet (template with placeholders): [TIMING.md](TIMING.md)
- [x] Repo, CI (`.github/workflows/ci.yml`), Pages deploy (`.github/workflows/deploy.yml`)
- [ ] Fill measured values in TIMING.md from gameplay footage (carried into M2–M4; does not block M1)
- [ ] Enable GitHub Pages with source "GitHub Actions"

## M1 deliverables (this repo)

- [x] Fixed 60 Hz timestep loop with frame-delta clamp and auto-pause on hidden tab — `src/engine/loop.ts`
- [x] 256 × 240 logical canvas, integer scaling, pixelated — `src/engine/screen.ts`
- [x] Pyramid grid (28 cells), diagonal neighbors, isometric projection — `src/game/pyramid.ts`
- [x] Pixel-exact cube rasterizer and draw order (falls behind the pyramid when hopping off a back edge) — `src/game/render.ts`
- [x] Hero state machine: idle → hopping (arc) → falling → respawn, input buffer — `src/game/hero.ts`
- [x] Keyboard input with arcade-rotated arrows, letters and numpad — `src/engine/input.ts`
- [x] Unit tests — `tests/`
- [x] Verify steady 60 fps on a real phone: crisp and smooth, no stutter in the demo hops (checked 2026-11-25 over the home network with `npm run dev -- --host`)

## M2 deliverables (this repo)

- [x] All 5 color rules as data, with 15 / 25 cube scoring for progress only — `src/game/rules.ts`
- [x] Per-cube color state and round-complete check — `src/game/board.ts`
- [x] 9 levels × 4 rounds, level 9 round 4 repeats; round bonus 1,000 + 250 per round — `src/game/rules.ts`
- [x] Game flow: level demo → playing → round-complete flash (bonus) → next round or next level's demo — `src/game/game.ts`
- [x] HUD: score, level, round, goal color sequence, demo and bonus captions; 3 × 5 pixel font — `src/game/render.ts`, `src/game/font.ts`
- [x] Unit tests for every rule, scoring, bonus and progression — `tests/rules.test.ts`, `tests/game.test.ts`
- [x] A look-ahead bot clears an empty pyramid through all 36 rounds with no falls — `tests/game.test.ts`
- [x] `?level=N` URL option to start at any level for playtesting
- [ ] Measure the sequence timings in [TIMING.md](TIMING.md) (placeholders for now)

## M3 deliverables (this repo)

- [x] Hazard balls: drop in, random downward bounces, fall off the bottom — `src/game/enemies.ts`
- [x] Egg → Chaser: hatches on the bottom row; pursuit AI that closes one hop per hop and never leaves the pyramid on its own — `src/game/enemies.ts`
- [x] Lift pads beside the edges; ride to the top, drop onto the apex; no spawns during the ride — `src/game/pads.ts`, `src/game/hero.ts`
- [x] Chaser lured off a pad for 500 — `src/game/game.ts`
- [x] Spawner with seeded randomness (first ball, then egg; one Chaser at a time) — `src/game/game.ts`, `src/game/rng.ts`
- [x] Collisions (half-hop rule plus same-frame swaps), death freeze with blinking Pip, life lost, enemies cleared
- [x] Lives (3), extra lives at 8,000 + every 14,000, game over and restart on a key
- [x] Unused lift pad bonus at round end (placeholder 50 / 100)
- [x] Sprites: hazard ball, egg, Chaser, lift pad, life icon; palette at 16 colors
- [x] Tests: enemy movement and AI, pads and the ride, spawning, collisions, lives, game over, the lure, and an idle player losing every life to the Chaser — `tests/enemies.test.ts`, `tests/hazards.test.ts`
- [x] `?enemies=0` URL option for the empty pyramid
- [ ] Measure the enemy and sequence timings in [TIMING.md](TIMING.md) (placeholders for now)
- [ ] Side-crawler rendering spike (risk mitigation from the plan doc), deferred to M4

