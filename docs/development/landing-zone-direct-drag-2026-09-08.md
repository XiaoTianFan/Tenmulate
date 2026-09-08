# Direct landing-zone drag verification — 2026-09-08

Implementation: `b90f791` on local `main`.

The flow under test is: Practice or drill editor → hover and left-drag the
rendered landing area → translate freely on the court without rotating the camera.
Dragging outside the zone continues to control camera look.

## Implementation

[ADR-0019](../decisions/0019-direct-landing-zone-manipulation.md) supersedes the
center/arrow interaction from ADR-0018. `LandingZoneControl` renders only the
filled rectangle, its boundary and the actual-bounce ring. Hover brightens the
area; dragging increases its contrast again. A raycast against the area captures
its ground-plane grab offset. Pointer motion changes both X and Z, including
diagonals, with no vertical displacement or center snap. The existing trajectory
compiler continues to apply court and service-box bounds.

`SceneViewport` chooses zone movement or camera look on the initial left-button
press and retains that choice until release/cancellation. Clicking without moving
does not nudge the zone. Additional pointers cannot replace an active gesture.
Touch uses the same hit area and disables browser pan only on interactive canvases.
Enter/Space and arrow keys provide camera-relative ground movement; Escape
deselects. A container query separates the hint from status text in narrower
previews, including the owner's existing in-app viewport.

## Automated checks

- `npm test`: **281 tests in 27 files pass**. Seven direct-interaction cases cover
  baseline and two oblique cameras, off-center grabs, both-coordinate translation,
  updates during a gesture, empty/hidden/read-only zones, click jitter, interrupted
  gestures, stationary hover refresh and camera-relative keyboard movement.
- `npm run build`: TypeScript, production/PWA build and active motion/cache guard
  pass. The existing renderer chunk-size warning remains.
- The active 25-clip asset remains `tennis-local-v1.64f3bc37161d.glb`; no motion,
  sampling or scheduling source was changed. The earlier
  [zone/continuous-preview receipt](landing-zone-verification-2026-09-08.md)
  retains its original distribution and 55-second loop evidence.

## Rendered checks

Browser plugin not available; regular Playwright used installed Chrome with
isolated browser storage. Target: `http://127.0.0.1:5173/`. The stopped local
preview was restarted against the current production build.

- Page identity and meaningful controls verified; venue and opponent loaded;
  no framework overlay or application errors. Chrome logged one existing Three.js
  shader precision warning, with no associated rendering failure.
- At 1440×1000, an off-center diagonal drag moved the zone center from
  `(0, -8.5)` to `(0.224292, -8.684009)` metres, preserving dimensions and camera.
  Simple clicks did not move it; hover and held-drag cursors matched the gesture.
- Dragging a zone outside its boundary kept the camera fixed. Starting on empty
  court and crossing the zone changed the camera while preserving the zone.
  Right-button dragging did not move either. Keyboard movement changed the zone
  and survived a practice reload.
- Rally, Return, Volley and Overhead presets all accepted area drags. Baseline
  camera framing was selected for these checks because Volley's net camera places
  the baseline landing area behind the viewer. Return dragging switched the
  automatic placement to a custom service-box zone.
- A drill-editor zone moved from center `(-2.7, -9.5)` to
  `(-2.638526, -9.380674)` metres; Save locally persisted that target and its
  `2.2 × 1.4 m` dimensions.
- At 390×844, a touch drag moved the center to `(0.119206, -8.321088)` metres
  without moving the camera or creating horizontal overflow.

## Evidence and review boundary

Local evidence directory:
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/`.

- `zone-direct-drag-qa.mjs` / `.json`: interaction and persistence assertions.
- `zone-direct-layout-qa.mjs` / `.json`: final responsive bounds checks.
- `zone-direct-idle.png`, `zone-direct-hover.png`, `zone-direct-dragged.png`,
  `zone-direct-oblique.png`, `zone-direct-editor.png`, `zone-direct-mobile.png`:
  rendered interaction evidence.
- `zone-direct-final-1440.png`, `zone-direct-final-886.png`,
  `zone-direct-final-390.png`: final layout after separating hint/status text.

Reference mismatch: the supplied screenshot's red/blue arrows and center control
are removed. The rendered zone itself now provides the interaction. The actual
bounce ring remains independent of its center. Desktop, narrow desktop and mobile
checks confirm the hint and status do not overlap and there is no horizontal
overflow. The existing in-app tab was refreshed to expose the implementation.

This is local implementation and automated/browser verification. Physical touch
hardware, owner interaction acceptance and public deployment are separate states.
