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

## Enemies (filled in M3–M4)

| Parameter | Placeholder | Measured | Source clip |
| --- | --- | --- | --- |
| Hazard ball hop interval, L1 | TBD | TBD | |
| First hazard ball spawn after round start | TBD | TBD | |
| Egg wait on bottom row before hatching | TBD | TBD | |
| Chaser hop interval, L1 | TBD | TBD | |
| Freeze duration | TBD | TBD | |
| Side crawler step interval | TBD | TBD | |
| Undoer hop interval | TBD | TBD | |
| Lift pad ride time to top | TBD | TBD | |
| Spawn interval range per round | TBD | TBD | |

## Sequences

| Parameter | Placeholder | Measured | Source clip | Used in |
| --- | --- | --- | --- | --- |
| Round-complete flash | 120 (8 per color) | TBD | | `ROUND_FLASH_FRAMES`, `ROUND_FLASH_PERIOD` |
| Level demo: title before first hop | 30 | TBD | | `DEMO_START_FRAMES` |
| Level demo: pause between hops | 10 | TBD | | `DEMO_HOP_PAUSE_FRAMES` |
| Level demo: hold after last hop | 45 | TBD | | `DEMO_END_FRAMES` |
| Level demo length (6 hops, total) | 240 | TBD | | derived |
| Death freeze before reset | TBD | TBD | | M3 |
