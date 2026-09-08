# Shared court and landing-zone resizing verification — 2026-09-08

Implementation: `32aabe2` on local `main`, under
[ADR-0020](../decisions/0020-shared-court-and-transactional-zone-editing.md).

## Findings and behavior

The previous zone control published settings on every pointer move. In Practice,
that invalidated the six-feed preview compiler; `TennisScene.setSession` also
rebuilt the continuous preview's next batch and motion events. `useDeferredValue`
did not make these synchronous computations cheap. The editor also recorded each
move as a separate undo entry. Separately, each route owned a `SceneViewport`, so
navigation disposed and reconstructed the renderer and its resources.

The new control retains the initial rectangle and previews only its Three.js
geometry while held. It reuses the boundary buffer and avoids stationary hover
raycasts. Release publishes one rectangle, including dimensions and center;
cancellation restores the model. The old actual-bounce marker hides until the
new session acknowledges the edit. Active-preview repetition state is scoped to
its session, preventing stale trajectories from replacing the committed preview.
Leaving Practice flushes the debounced settings, preserving an immediate edit.

Interior movement, four side handles and four corner handles operate on the court
plane. Resizing anchors the opposite bounds. Grips appear on hover/selection and
the cursor follows the projected resize direction. Mouse/touch gesture ownership,
camera-relative keyboard movement, numeric dimensions, court/service limits and
uniform target sampling remain supported. Editor resizing is one undo transaction.

`SharedCourtProvider` moves one stable portal container between route slots.
Practice, Editor and rehearsal playback retain the canvas, scene, WebGL context,
opponent and unchanged venue. The drill library parks the scene with its animation
loop stopped; document hiding also suspends rendering. The current environment
and quality flow into Editor and drill launches. Pointer activity from the portal
still reveals the hidden rehearsal HUD.

The two annotated Uniform explanations are removed and the control is named
**Shot Variation**. Editor wording is consistent. Corner presets now use lateral
positions ±3.6 m, 2.8 m behind the baseline, at 1.68 m eye height. Volley uses the
center line at Z = -5.4 m, one metre netward of the service T, at 1.66 m eye height.
These three presets aim at `(0, 0, 11.885)` and preserve the chosen FOV. Exact
untouched legacy presets migrate; edited/custom positions are preserved.

## Automated and browser results

- `npm test`: **288 tests in 27 files pass**. Twelve control tests cover baseline
  and oblique views, four corners, sides, anchored bounds, reusable geometry,
  100 moves without a callback, one release commit, cancellation, click jitter,
  read-only/hidden zones, bounds and keyboard movement. Camera tests verify the
  actual renderer ray reaches the opposite baseline center; storage tests cover
  migration and custom-preset preservation.
- `npm run build`: TypeScript, production/PWA build and active motion/cache guard
  pass. The existing renderer chunk-size warning remains. The active asset is
  unchanged: `tennis-local-v1.64f3bc37161d.glb`, 25 clips, 1.88 m mannequin.
- Production Chrome at `http://127.0.0.1:5173/`, with isolated storage, passes
  interior/side/corner gestures. The session revision remains unchanged during
  each held gesture and increments once on release. Camera settings stay fixed.
- Editor corner resizing, Undo, Redo and Save locally pass. One Undo restores
  all four original bounds; saved target and dimensions match the resized zone.
- Practice → Editor → Drills → Run drill → Exit → Practice retains the exact
  canvas node and scene ID. Instrumentation observed **one WebGL context**, one
  opponent GLB request and one venue GLB request across the sequence. The parked
  library issued **zero draw calls** during a 400 ms sample after settling.
  Hiding the rehearsal HUD and moving the pointer reveals its Exit control.
- Chrome touch emulation at **390×844** passes interior movement, side resizing,
  corner resizing and cancellation without moving the camera. Layout has zero
  horizontal overflow; hint and status bounds do not overlap. Practice settings
  survive navigation within the 180 ms persistence debounce window: a 2.1 m zone
  width is restored on return. The **685×898** layout shows the shortened text.
- Actual left/right/volley camera images were compared with the supplied court
  references. Diagonal corner framing points toward far-baseline center; volley
  framing follows the center line. The Volley practice preset also uses this
  orientation. The chosen 70° FOV remained unchanged in the preset checks.
- No application errors in the checks. One existing Three.js shader precision
  warning was recorded in the desktop run without a rendering failure. The
  owner's existing in-app tab was refreshed; its new resizing hint, accessible
  controls and Shot Variation label were read back, and its layout inspected.

Regular Playwright with installed Chrome was used for repeatable isolated browser
checks because the browser testing plugin was unavailable when the test workflow
was selected. CUA was used to refresh and inspect the owner's existing tab.

## Bounded drag comparison

One local before/after sample used the same 80 pointer moves, 16 ms requested
pacing, 1440×1000 viewport, Performance quality and starting zone. Browser protocol
overhead is included in input timing and wall-clock duration.

| Measurement | Before | After |
| --- | ---: | ---: |
| Time to deliver the 80 held moves | 5,035 ms | 2,668 ms |
| Median animation-frame interval | 4.3 ms | 12.5 ms |
| 95th-percentile animation-frame interval | 33.3 ms | 12.6 ms |
| Maximum animation-frame interval | 41.7 ms | 25.0 ms |
| 95th-percentile pointer-command latency | 52 ms | 16 ms |
| Long tasks over 50 ms | 0 | 0 |

The result supports reduced stalls and removal of drag-triggered recompilation,
not a universal FPS or thermal claim. The after sample kept session revision 1
through the entire drag and advanced to 2 on release. Natural preview progression
can still prepare future feeds on its existing schedule, and releasing an edit
still performs one synchronous compilation. Physical-device temperature, physical
touch hardware, owner acceptance and public deployment were not qualified here.

## Evidence

Local evidence directory:
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/`.

- `zone-drag-perf.mjs`, `zone-drag-perf-before.json`, `zone-drag-perf-after.json`.
- `shared-court-resize-qa.mjs` / `.json`: desktop interactions, scene/context/asset
  reuse, parking, editor undo/save, camera targets and rehearsal HUD.
- `shared-court-mobile-qa.mjs` / `.json`: touch, cancellation, responsive bounds,
  immediate navigation persistence and annotated text.
- `zone-resize-practice.png`, `zone-resize-editor.png`,
  `shared-court-drill-playback.png`, `shared-court-mobile-390.png`,
  `shot-variation-cleanup-685.png`.
- `camera-refined-left-corner.png`, `camera-refined-right-corner.png`,
  `camera-refined-at-the-net.png`.

The original distribution and continuous-preview evidence remains in the
[uniform-zone receipt](landing-zone-verification-2026-09-08.md). This stage changes
editing, scene lifetime and camera presets, without replacing that sampling or
motion contract.
