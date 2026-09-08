# Short running steps correction — 2026-09-08

Implementation `330ecca`, following [ADR-0033](../decisions/0033-complete-short-running-steps.md),
corrects owner-rejected movement from baseline `7800cd8` / `b46dd85`.

## Report and first divergent stage

The owner's screenshot `codex-clipboard-9f6f4078-7402-401c-8692-727a074cb6de.png`
shows a 2.5 s interval, 150%/150% preferences and roughly 218%/285% resolved rates.
They still saw jerky walking where one or two running steps would suffice.

The live browser had the previous build and selected `run-forward`; its foot
correction and shortened loop still produced a shuffling silhouette. The former
test verified the clip, rate and structural rig constraints but did not reject
low, partial footwork. That was insufficient evidence of the requested appearance.

The correction replaces urgent short travel with a complete two-placement action,
clear running heel lift, a source phase aligned to the first anatomical foot, and
grounded final anchors. Longer/slower routes blend into the existing gait system.
Interval solving, contact clocks, root bounds and the motion asset remain unchanged.

## Actual rig comparison

Both hands, identical 0.7/0.8/0.9 m routes and 0.710/0.759/0.805 s durations,
sampled through the production GLB and `OpponentRig` at 240 Hz:

| Measurement | Previous correction | Updated correction |
| --- | --- | --- |
| Peak ankle lift, left/right range | 5.1–9.2 cm | 18.98–19.00 cm |
| Lift episodes per foot, threshold 2.5 cm | 1 | 1 |
| Motion cycle | Truncated low jogging loop | One complete running cycle, two final placements |
| Peak native running rate | 0.750–0.754× | 1.065–1.208× |
| Additional pelvis lowering from foot reach correction | 0–0.38 mm | 0 mm |

The lift count alone did not distinguish the rejected motion. The updated
regression requires a single clear lift above 14 cm per foot, grounded support
without scuffing, and preserved structure. The previous measurements fail that
lift requirement; thresholds describe this gameplay action, not human-population
biomechanics. Source inspection confirms `run-forward` starts with the right foot
in swing, motivating the left-first half-cycle phase offset.

## Checks and visible result

- **355 tests / 37 files pass**. Both hands and both lateral directions retain
  fixed limb lengths, 2 mm foot-target accuracy, deterministic seeks, grip
  repeatability and under 3.5 cm foot displacement per 1/240 s sample.
- The 0.4–1.8 m transition envelope retains continuous stride/rate selection and
  exact start/end foot anchors, including partially blended short-step patterns.
- Actual 2.5 s / 150%/150% Rally: all five compiled gaps remain exactly 2.5 s.
  Recovery, split, approach, preparation and stroke run on the same clock.
- All 16 bundled drills: post-IK contact error below 0.002 mm, peak root speed
  below 4.008 m/s and approach/entry mismatch below 1e-14 s. Infeasible drill
  intervals still extend within the existing physical/rally budgets.
- Actual scene key frames inspected in close and player POV views. The complete
  rally and controlled previous/current comparison are retained as 30 fps videos.
  No new public motion clip or captured-performance fidelity claim is made.
- TypeScript, production/PWA build and motion/cache checks pass. The existing
  renderer bundle-size advisory remains. The sole active GLB still has SHA-256
  `64f3bc37161dfc2fcf536e80a6e39465792bdc6a822dd26493d04d2ab2bd3eaf`.
- Both real browser tabs load `app-BfChKf5y.js` with the opponent ready. Edge's
  saved 2.5 s, 150% stroke and 150% movement settings are retained and its updated
  practice preview is running. Reload returns its paused rehearsal to Practice.

## Retained local evidence

`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/short-running-steps/`

- `opponentMovement.before.ts`, `locomotion.before.ts`: rejected baseline.
- `review.mjs`, `result.json`: reproducible production-scene capture, exact
  fixture, old/new rig measurements, all-drill checks and adapter identity.
- `comparison.mp4`, `comparison-strip.png`: same route, previous vs updated.
- `rally.mp4`, `rally-strip.png`, `pov/`: gameplay sequence and player view.
- `index.html`: normal-speed comparison player; `package-review.mjs`: packaging.

The isolated capture server/browser close after the run. The user's existing
preview server stays running. This records local implementation and agent checks;
owner visual acceptance and public deployment remain separate states.
