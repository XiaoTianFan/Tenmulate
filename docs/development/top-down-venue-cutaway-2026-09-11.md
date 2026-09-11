# Top-down venue cutaway — 2026-09-11

## Problem and implementation

Practice and Editor moved their overview camera above the indoor ceiling without
enabling the venue renderer's existing roof cutaway. On the indoor hard court,
all twelve sampled court sightlines hit roof panels at approximately 12.2–12.4 m.

Both screens now pass their temporary overview state through the shared viewport
to `TennisScene`. Roof visibility combines this state with the separate venue-review
setting. Every venue manager receives the state, including inactive managers, so
asynchronous loading and Quality/Performance changes retain the cutaway before
an asset becomes visible. Leaving overview restores the roof. Saved player cameras,
venue assets and ordinary gameplay views retain their existing behavior.

## Verification

- All six venues inspected in the actual renderer: hard-open-arena,
  clay-sunset-arena, grass-center-court, timber-hall, clay-stadium and
  covered-grass-arena, each in Quality and Performance mode.
- 108 camera-height/FOV combinations: overview height computed for aspect ratios
  0.5, 1.6 and 3, each with FOV 30, 90 and 110. These are camera parameter tests,
  not 108 independently resized browser windows.
- Twelve court sightlines per combination (1,296 total) reached the court without
  overhead obstruction. Roof nodes were hidden in every case and restored for
  every one of the twelve venue/quality pairs. Screenshots of all six venues
  confirmed visible courts with surrounding venue structures retained.
- Actual Practice and Editor controls tested on indoor grass: overview, return to
  player/shot view and Editor-overview-to-Practice handoff. The roof restored and
  the shared renderer cleared its overview flag on exit.
- **580 tests in 54 files passed**. Production build and active motion/cache guard
  passed. Six new regression cases cover cutaway retention during asynchronous
  venue loading and quality switching.
- No browser errors observed. Existing Three.js PMREM sigma/sample-limit warnings
  appeared during environment changes; this fix does not alter that sky pipeline.

The full build also exposed a readonly mutation in the previous both-hand stroke
test fixture. That fixture now uses immutable copies; runtime motion behavior is
unchanged. Local implementation and verification only; no public deployment or
owner visual acceptance is claimed.
