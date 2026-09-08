# Movement selection verification — 2026-09-08

Implementation `b46dd85` follows [ADR-0032](../decisions/0032-speed-and-cadence-locomotion.md)
over baseline `5f1e576`. Local implementation and verification are complete; no public deployment
or Windows GPU preference change was performed.

## Reproduction and result

Controlled old/new `sampleTravel` comparisons use identical lateral routes,
headings, source assets and travel durations at the existing 12 m/s² acceleration
ceiling. The change is gait/stride/cadence selection, not faster root translation.

| Distance | Duration | Peak travel speed | Previous walk rate | Updated run-clip rate | Updated cycle distance |
| --- | --- | --- | --- | --- | --- |
| 0.7 m | 0.710 s | 1.409 m/s | 1.484× | 0.750× | 1.127 m |
| 0.8 m | 0.759 s | 1.507 m/s | 1.586× | 0.751× | 1.204 m |
| 0.9 m | 0.805 s | 1.598 m/s | 1.682× | 0.754× | 1.271 m |

All three now select the jogging blend. Running weight is 99.6%, 100% and 100%;
lower foot lift/longer stance distinguish the short jog from a full sprint.
Source rate is source-seconds per wall-second at peak travel speed. Cycle distance
is one complete source cycle, not the distance between successive opposing feet.

The actual Quick Practice Rally fixture uses alternating groundstrokes, a 2.5 s
interval, 150% stroke/movement preferences, 70 km/h, 1103 rpm, hard court, no shot
variation and seed `movement-selection`. All five gaps remain exactly **2.5 s**.
The existing interval search resolves stroke rates of 207–234% and movement rates
of 273–285%. It still extends an infeasible interval rather than exceeding physical
travel limits. No ball physics, target sampling or camera logic changed.

## Verification

- `npm test`: **354 tests / 37 files**, all pass.
- `npm run build`: TypeScript, production/PWA build and active-motion/cache guard
  pass. The existing large-bundle advisory remains.
- Speed/cadence sweep: 0.21–7.2 m/s, 0.4/0.8/4 m routes and forward/lateral travel;
  normalized weights, bounded active source rates and continuous cycle distance.
- Former 0.65/1.1 m gates: continuous gait weights, stride, lift and stance across
  both boundaries. Deterministic seeking preserves pose/foot clocks for both hands.
- Actual skinned rig at 240 Hz: 0.7/0.8/0.9 m jogging, both hands. Consecutive foot
  travel stays below 3.5 cm; foot targets remain within 2 mm; limb-length variation
  stays below 1 micrometer (float32 allowance); repeated samples preserve the grip.
- All 16 bundled drills at 120 Hz: peak root speed at most 4.008 m/s, post-IK racket
  contact error below 0.002 mm and approach/stroke-entry mismatch below 1e-14 s.
  Some 2.5 s drill intervals are correctly reported as limited by their full
  movement/return budgets; this test does not claim every drill fits 2.5 s.
- Production Three.js/GLB captures: old/new 0.9 m travel, full recovery → approach
  → prepared stroke, and baseline POV. Key-frame comparisons inspected for stance,
  knee/foot shape, racket carry and preparation continuity. Normal-speed 30 fps
  comparison/rally videos are retained for owner review.
- Real Codex and Edge tabs reloaded `app-C8C8SSqy.js`, with venue/opponent ready.
  A live Codex sample at the user's saved settings shows run-forward during
  approach/recovery, preparation while braking, and uninterrupted preview cycle 5.

## Artifacts and reproduction

Local evidence directory:
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/movement-selection/`

`review.mjs` starts an isolated Vite source server and headless Edge, imports the
baseline `opponentMovement.before.ts`, and samples the production renderer/rig.
The isolated browser selected RTX 4080; it does not alter the user's Edge profile
or OS GPU preferences. The server and browser close in `finally`.

- `result.json`: exact fixture, adapter, route timing/contact metrics and gait rows.
- `comparison.mp4`, `comparison-strip.png`: identical 0.9 m old/new route.
- `rally.mp4`, `rally-strip.png`: actual 2.5 s gameplay sequence at a close review view.
- `pov/`: baseline-view frames; `index.html`: local comparison player.
- `review.mjs`, `package-review.mjs`: capture and packaging scripts.

The active 25-clip bundle remains
`tennis-local-v1.64f3bc37161d.glb`; no motion-production artifacts were regenerated.
