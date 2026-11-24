# Cube Hopper

A browser arcade game: hop around a pyramid of 28 cubes, turn every cube top to the goal color, and avoid whatever is bouncing down after you.

Cube Hopper recreates the *gameplay rules* of a classic 1982 isometric arcade game. All names, characters, artwork and sound in this repository are original. See [docs/IP.md](docs/IP.md).

## Status

| Milestone | Scope | State |
| --- | --- | --- |
| M0 | Pre-production: design spec, timing sheet, repo + CI + deploy | Done |
| M1 | Core engine: loop, scaling, pyramid, hero hops, fall-off death | Done |
| M2 | Cube color rules, rounds and levels | Next |
| M3–M8 | Hazards, full cast, art/audio, shell, platforms, release | Planned |

Full plan: [docs/PLAN.md](docs/PLAN.md).

## Play (M1 build)

The arrow keys behave like the original's 45°-rotated joystick:

| Hop | Arrow | Letter | Numpad |
| --- | --- | --- | --- |
| Up-right | ↑ | E | 9 |
| Down-right | → | D | 3 |
| Down-left | ↓ | A | 1 |
| Up-left | ← | Q | 7 |

Hold a direction to keep hopping. Hop off an edge and you fall, then respawn at the top.

## Develop

Requires Node 20+.

```sh
npm install        # first time; commit the generated package-lock.json
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript, no emit
npm run build      # static build in dist/
```

## Deploy

`.github/workflows/deploy.yml` publishes `dist/` to GitHub Pages on every push to `main`. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Layout

```
docs/            plan, design spec, timing sheet, IP rules
src/engine/      game-agnostic pieces: fixed-step loop, screen scaling, keyboard input
src/game/        pyramid geometry, hero state machine, palette, sprites, renderer
src/main.ts      wiring
tests/           Vitest unit tests
```
