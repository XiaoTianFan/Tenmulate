# Landing zones and continuous preview verification

Implementation: `97783ed` on local `main`, 2026-09-08.
Contract: [ADR-0018](../decisions/0018-uniform-landing-zones-and-continuous-preview.md).
This supersedes the fixed-point and CSS-handle presentation in the earlier
[practice refinement receipt](practice-refinement-2026-09-08.md).

## Delivered behavior

- All Quick Practice families and every bundled/custom drill primitive acquire
  a uniform rectangular landing zone. Width/depth are editable in practice and
  per drill event; legacy documents/preferences receive family defaults. Event
  dimensions and speed/spin variation survive validated JSON and local saves.
- The zone, X/Z translation arrows, origin and actual-bounce ring are Three.js
  geometry. Arrows keep court orientation under camera rotation and perspective.
  Pointer capture prevents camera drift. Enter selects the zone, X/Z selects an
  axis, arrow keys move it, and Escape deselects. The editor has a raised,
  rotatable inspection camera so edge zones fit in view.
- Setup produces fresh seeded batches on one absolute clock, preserving previous
  balls and upcoming preparation. Selected set counts/rests apply when practice
  is launched. Parameter fitting never resamples an inconvenient landing target.
  Natural zone fitting can extend speed adjustment to ±50% when necessary; exact
  sampled speed/spin and explicit unreachable status remain available.

## Automated evidence

`npm test -- --reporter=dot`: **276 tests / 27 files passed**.
`npm run build`: passed, including the selected-motion offline-cache guard.
`npm run check:motion`: passed for all 25 clips in the unchanged active GLB
`tennis-local-v1.64f3bc37161d.glb`. The build retains a non-fatal large-chunk warning.

Focused checks cover:

- 16,000 samples each for ordinary and clipped service-box zones, with 4×4 bins,
  coordinate means and no edge mass from clamping sampled points.
- Both-hand Quick Practice bounces for groundstroke, serve, volley, overhead and
  lob, plus all 26 drill primitives, including custom dimensions/parameter ranges.
  Supported samples fit within the existing 0.18 m trajectory acceptance tolerance.
- Independent and repeatable landing/speed/spin/timing streams; parameter variation
  zero still varies landings. Uniformity describes sampled coordinates/parameters;
  physical fitting can alter the distribution of resolved speed and spin.
- Four fresh preview boundaries for every Quick Practice family, bounded retained
  events, deterministic rewind and finite launched-session rest/count behavior.
- Loaded-rig post-IK contact at a fresh-batch boundary for both hands and four
  stroke families, with contact error below 2 mm and continuous adjacent poses.
- World-axis raycasting/dragging from baseline and oblique cameras, JSON validation,
  legacy storage migration, and the existing trajectory/motion/rally regression suite.

The broader samples found that the old ±15% speed neighborhood could not land a
short half-volley in its zone. Natural zone fitting now slows that ball without
changing its sampled target. A negative test confirms that the same exact-speed
request remains explicitly unreachable. Fresh samples also exposed subtraction
roundoff at a return handoff; comparison now uses the absolute contact time.

## Browser evidence

Regular cached Playwright/Chrome was used for isolated test contexts because the
frontend skill's dedicated Browser plugin was not listed. The user's existing
in-app browser was refreshed through CUA and its new controls were read back.
No test preferences or custom drills were written into the user's browser context.

Production preview: `http://127.0.0.1:5173/`, **1440×1000** and **390×844**.
Development preview supplied the continuous-clock measurement at port 4173.

- X drag changed direction while retaining depth; Z drag changed depth while
  retaining world X. Both preserved the camera. Enter/Z/ArrowUp changed depth
  by 0.2 m, retained X and preserved the oblique camera.
- Practice dimensions 2.4×2.6 m survived reload. Return service zones remained
  inside the diagonal box. The editor saved 2.2×1.4 m and 12% parameter variation.
- Geometry was visually inspected at baseline and oblique angles and in the
  raised editor view. The former `.landing-controls` DOM component is absent.
- Narrow-layout inspection found no horizontal overflow. All tested flows
  reported zero application errors. One test initially stopped at the normal
  post-save modal; closing that modal completed the flow on rerun.
- With **1 repetition, work block 1, rest 120 s**, the preview ran **55.41 wall
  seconds**, crossed two fresh-batch boundaries and displayed 12 distinct sampled
  targets. The session clock remained monotonic; the maximum observed clock step
  was 29.2 ms. Both boundary samples retained the forehand pose/root and outgoing
  ball rather than restarting the countdown or entering the planned rest.

Evidence folder:
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/`.
Receipts: `production-zone-ui.json`, `zone-continuous-preview.json`.
Images: `production-zone-world-gizmo.png`, `production-zone-oblique-gizmo.png`,
`production-zone-return-service-box.png`, `production-zone-drill-editor.png`,
`production-zone-mobile-390.png`, `zone-continuous-preview.png`.

This is local implementation and browser/mechanical verification. Numerical
trajectory tolerance, infeasible configurations, owner technique acceptance,
target-device qualification and public deployment remain distinct boundaries.
