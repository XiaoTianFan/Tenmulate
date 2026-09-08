# Groundstroke trajectory refinement — 2026-09-08

Local implementation, numerical checks, production build and browser review
are complete. No remote push or public deployment. Subjective playing feel and
target-device thermal/performance acceptance remain owner review.

## Diagnosis and physical basis

The previous Natural resolver stopped expanding pace once it reached the target,
even if the groundstroke was still too high. It scored launch angle rather than
height at the net and searched spin only within ±20%, after speed. Reducing
excessive topspin was therefore barely available for a slow/deep intention.

[Rod Cross, Ball Trajectories](https://www.physics.sydney.edu.au/~cross/TRAJECTORIES/42.%20Ball%20Trajectories.pdf)
shows the coupled effects directly: at 30 m/s, a baseline-length ball from 1 m
needs about 8.1 degrees without spin versus 11.9 degrees with 20 revolutions/s of
topspin. More topspin at the same speed does not automatically make a deep ball
flatter. [TWU's free-flight drag/lift experiment](https://twu.tennis-warehouse.com/learning_center/aerodynamics2.php)
also measures the separate influences of speed and spin. These support a joint
inverse search; they do not prescribe the product's 3.5 m comfort threshold or
adjustment bounds. Very low launch speeds still have physical range limits, and
launch speed is different from the decelerated speed arriving at the player.

[ADR-0030](../decisions/0030-groundstroke-net-clearance-search.md) records the
current search contract. No force coefficient was weakened to manufacture a
flatter result. The 1/240 s integrator, source/contact positions, wind and impact
model remain. Natural groundstrokes can choose much less spin, while Exact and
Lob preserve deliberate high-ball options.

## Evidence

For a 61 km/h, 1224 rpm request, source `(0, 1.15, 12.885)` and target
`(0, -10.5)`, both using a 1.6 × 2 m landing zone:

| Result | Previous | Current |
| --- | ---: | ---: |
| Clearance above net tape | 4.117 m | 2.605 m |
| Apex above court | 5.065 m | 3.564 m |
| Resolved launch speed | 70.15 km/h | 76.25 km/h |
| Resolved spin | 979.2 rpm | 306 rpm |
| Pre-bounce speed | 48.65 km/h | 51.17 km/h |
| First-bounce target error | 0.0004 m | 0.0151 m |

The real Three.js court rendered the old integrated result and new resolver from
identical player and side cameras. The side view confirms the lower arc and same
landing zone. Both draws returned zero WebGL errors. A 45 km/h deep request also
verified the soft threshold: it remains physically valid above 3.5 m when the
±50% pace bound cannot reach that depth on a lower arc. An explicit 4 m minimum,
Exact high groundstroke, and high Lob remain valid.

- **332 tests / 34 files pass.** New regressions cover the reported deep ball,
  lower spin versus acceleration, soft-bound feasibility, high requests,
  flat/topspin/slice lateral targets, and preservation of comfortable/zero-spin
  feeds. Existing full-content zone fitting, deterministic sampling, heading
  continuity, wind/impact and motion/camera tests pass.
- **Production build passes**, including the active motion/asset/precache guard.
  The existing large-chunk advisory remains. No opponent or venue asset changed.
- **Production browser checks pass:** Natural/Exact switching, visible resolved
  speed/rpm, editor preview, drill playback and saved-input reload. The same
  scene instance survives mode switches. Zero page/console errors.
- The wider search initially regressed computation. Reusing first-flight vectors,
  stopping at the low-range bracket and bounding refinement removed that
  regression for the reproduced case: about 22 ms versus 24 ms previously in
  an isolated Chrome probe. A 24-input sweep took about 9–26 ms per final solve;
  this is local illustrative timing, not a device-performance acceptance claim.

Browser verification used the available regular Playwright/Chrome runner and an
isolated source harness; production UI checks ran against `127.0.0.1:5173`.
The existing production preview was rebuilt and the user's tab refreshed.
Evidence is under
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/`:
`trajectory-baseline.json`, `trajectory-final.json`, `trajectory-render-result.json`,
`trajectory-ui-result.json`, `trajectory-player-{old,current}.png` and
`trajectory-side-{old,current}.png`.
