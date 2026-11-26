# Reference timing sheet

Exact speeds and spawn times for the original game are not published. This sheet holds our **placeholder** values (used by the code now) and the **measured** values we will tune toward in M8. All times are in frames at 60 Hz.

## How to measure

1. Use publicly available gameplay video at 60 fps (no ROMs; see [IP.md](IP.md)).
2. Step frame by frame and count frames between events (e.g. take-off to landing).
3. Record at least 5 samples per value per level; enter the median and the clip reference.
4. Enter the median in the Measured column. Per-level and per-round values live in `src/data/rounds.json`; fixed ones in `src/game/constants.ts`.
5. `tests/config.test.ts` checks that every row naming a `rounds.json` key matches the level 1 data within 10%, using Measured once it is filled in and Placeholder until then. After measuring, update the JSON until that test passes.

## Hero

| Parameter | Placeholder | Measured | Source clip | Used in |
| --- | --- | --- | --- | --- |
| Hop duration (L1) | 18 | TBD | | `HOP_FRAMES`, `rounds.json speed.heroHop` |
| Hop duration change per level | 18 → 14 by L9 (about −0.5 per level) | TBD | | rounds.json, every level |
| Hop arc height (px) | 12 | TBD | | `HOP_HEIGHT` |
| Pause between held-direction hops | 0 | TBD | | not modeled yet |
| Fall time until off screen | 60 | TBD | | `FALL_FRAMES` |
| Respawn delay after fall | 45 | TBD | | `RESPAWN_DELAY_FRAMES` |
| Input buffer window | 6 | n/a (design choice) | | `INPUT_BUFFER_FRAMES` |

## Enemies

| Parameter | Placeholder | Measured | Source clip | Used in |
| --- | --- | --- | --- | --- |
| Enemy drop-in from above onto row 1 | 24 | TBD | | `ENEMY_DROP_FRAMES` |
| Enemy hop duration, L1 | 18 (same as hero) | TBD | | `rounds.json speed.enemyHop` |
| Hazard ball / freeze orb rest between hops, L1 | 14 (32 per hop with the hop) | TBD | | `rounds.json speed.ballRest` |
| First hazard ball spawn after round start, L1 | 120 | TBD | | `rounds.json spawn.first` |
| Spawn interval, L1 round 1 | 150 | TBD | | `rounds.json spawn.interval` |
| Max hazard balls at once, L1 | 2 | TBD | | `rounds.json spawn.maxBalls` |
| Egg wait on bottom row before hatching, L1 | 60 | TBD | | `rounds.json speed.eggHatch` |
| Egg / Chaser rest between hops, L1 | 18 (36 per hop with the hop) | TBD | | `rounds.json speed.chaserRest` |
| Lift pad ride time to top | 90 + 12 drop | TBD | | `LIFT_RIDE_FRAMES`, `LIFT_DROP_FRAMES` |
| Freeze duration, L1 | 300 | TBD | | `rounds.json speed.freeze` |
| Frozen enemies blink before moving again | 60 | n/a (design choice) | | `FREEZE_WARN_FRAMES` |
| Side crawler rest between steps, L1 | 20 (38 per step with the step) | TBD | | `rounds.json speed.crawlerRest` |
| Undoer rest between hops, L1 | 16 (34 per hop with the hop) | TBD | | `rounds.json speed.undoerRest` |
| Spawn interval range | 150 (L1R1) down to 75 (L9R4) | TBD | | rounds.json, every round |

## Sequences

| Parameter | Placeholder | Measured | Source clip | Used in |
| --- | --- | --- | --- | --- |
| Round-complete flash | 120 (8 per color) | TBD | | `ROUND_FLASH_FRAMES`, `ROUND_FLASH_PERIOD` |
| Level demo: title before first hop | 30 | TBD | | `DEMO_START_FRAMES` |
| Level demo: pause between hops | 10 | TBD | | `DEMO_HOP_PAUSE_FRAMES` |
| Level demo: hold after last hop | 45 | TBD | | `DEMO_END_FRAMES` |
| Level demo length (6 hops, total) | 240 | TBD | | derived |
| Death freeze before reset | 90 | TBD | | `DEATH_FREEZE_FRAMES` |
| Game over: minimum before a key restarts | 60 | n/a (design choice) | | `GAME_OVER_MIN_FRAMES` |
