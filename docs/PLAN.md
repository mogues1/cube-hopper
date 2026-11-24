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
- [ ] Verify steady 60 fps on a real phone (manual check once deployed)
