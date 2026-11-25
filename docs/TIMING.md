# Reference timing sheet

Exact speeds and spawn times for the original game are not published. This sheet holds our **placeholder** values (used by the code now) and the **measured** values we will tune toward in M8. All times are in frames at 60 Hz.

## How to measure

1. Use publicly available gameplay video at 60 fps (no ROMs; see [IP.md](IP.md)).
2. Step frame by frame and count frames between events (e.g. take-off to landing).
3. Record at least 5 samples per value per level; enter the median and the clip reference.
4. Keep values in `src/game/constants.ts` (M1) and, from M4, in per-round JSON.

## Hero

| Parameter | Placeholder | Measured | Source clip | Used in |
| --- | --- | --- | --- | --- |
| Hop duration (L1) | 18 | TBD | | `HOP_FRAMES` |
| Hop duration change per level | 0 | TBD | | M4 |
| Hop arc height (px) | 12 | TBD | | `HOP_HEIGHT` |
| Pause between held-direction hops | 0 | TBD | | M2 |
| Fall time until off screen | 60 | TBD | | `FALL_FRAMES` |
| Respawn delay after fall | 45 | TBD | | `RESPAWN_DELAY_FRAMES` |
| Input buffer window | 6 | n/a (design choice) | | `INPUT_BUFFER_FRAMES` |

## Enemies (M3 placeholders; the rest in M4)

| Parameter | Placeholder | Measured | Source clip | Used in |
| --- | --- | --- | --- | --- |
| Enemy drop-in from above onto row 1 | 24 | TBD | | `ENEMY_DROP_FRAMES` |
| Enemy hop duration | 18 (same as hero) | TBD | | `HOP_FRAMES` |
| Hazard ball rest between hops, L1 | 14 (32 per hop with the hop) | TBD | | `BALL_PAUSE_FRAMES` |
| First hazard ball spawn after round start | 120 | TBD | | `FIRST_SPAWN_FRAMES` |
| Spawn interval | 150 | TBD | | `SPAWN_INTERVAL_FRAMES` |
| Max hazard balls at once, L1 | 2 | TBD | | `MAX_HAZARD_BALLS` |
| Egg wait on bottom row before hatching | 60 | TBD | | `EGG_HATCH_FRAMES` |
| Egg / Chaser rest between hops, L1 | 18 (36 per hop with the hop) | TBD | | `CHASER_PAUSE_FRAMES` |
| Lift pad ride time to top | 90 + 12 drop | TBD | | `LIFT_RIDE_FRAMES`, `LIFT_DROP_FRAMES` |
| Freeze duration | TBD | TBD | | M4 |
| Side crawler step interval | TBD | TBD | | M4 |
| Undoer hop interval | TBD | TBD | | M4 |
| Spawn interval range per round | TBD | TBD | | M4 |

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
