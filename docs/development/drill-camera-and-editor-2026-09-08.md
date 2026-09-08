# Drill camera, return space and reusable shots — 2026-09-08

Status: implemented and verified locally. Core stage: `b790ac2`; editor and final
integration follow in a focused commit. No push or public deployment. Owner
experience acceptance and target-device qualification remain separate.

## Behavior

- `gameplay-rhythm-v5` compiles one absolute camera timeline. No shot transition
  reconstructs the camera from the launch view or waits for a React HUD update.
  Unscripted shots retain the preceding view; legacy destinations become shot views.
- Quintic position curves start/finish at zero velocity and acceleration. Peak
  travel stays within 4.5 m/s and 5.5 m/s² using the existing player calibration;
  preferred movement pace and gaze-turn duration can lengthen shot intervals.
  The view tracks the current opponent root at chest height during travel, then
  settles to the configured heading/tilt before the next preparation stage.
- Return space defaults to 1.2 m forward, 3 m wide and 2 m deep. It follows camera
  position/yaw, with the near edge clipped 5 cm in front of the viewer. The return
  must start at a real incoming sample inside the zone and at a legal contact height,
  then solve to the next racket contact. Failed links remain new feeds.
- Editor sections expose opponent position/hand/stroke, camera presets and complete
  view, pace, spin/rpm, variation, bounce, net clearance, fitting style, shot interval,
  independent movement/stroke rhythm, serve rhythm and cue. Landing geometry remains
  editable on the court. Return distance and size have a blue 3D footprint and overview.
- Saved shots freeze inherited settings and deep-copy into new events. Saving an
  updated preset does not change shots already inserted in a drill. Local storage
  and JSON validation accept the optional fields and reject invalid records. Existing
  local data loads without a migration prompt. Exported drills stay self-contained.
- Camera pointer drags commit once on release; wheel changes commit after the gesture
  settles. Test → Exit retains unsaved drill changes. One mounted court remains shared.
  Rehearsal explicitly enables the camera timeline; MotionLab inspection views stay manual.

## Verification

- `npm test`: **309 tests in 30 files**, all pass. New coverage includes shot-view
  holds, boundary continuity, maximum pace/acceleration, opponent tracking, yaw-wrap
  fades, deterministic seeking, reduced motion, real return contacts, event overrides,
  saved-shot independence, inherited defaults, invalid data and older storage.
- `npm run build`: pass, including the active-asset/PWA cache guard. The existing
  large-renderer-chunk advisory remains. `npm run check:motion`: pass; the 25-clip
  1.88 m mannequin bundle remains `64f3bc37161dfc2fcf536e80a6e39465792bdc6a822dd26493d04d2ab2bd3eaf`.
- Browser plugin not available; regular Playwright/Chrome used for isolated browser
  checks, and CUA for refreshing the user's existing local preview.
- Production editor at 1600 × 1000: complete shot configuration; opponent presets;
  return dimensions; save/add/update preset; independent event copies; drill export,
  save and reload; unsaved Test → Exit; shared canvas identity. No page errors.
- Camera drag: session revision **22 while held → 23 on release**, with no intermediate
  recompilation. Preview view fields match the saved snapshot.
- Phone layout: viewport **390 px**, document scroll width **390 px**. The timeline
  scrolls internally instead of stretching the editor.
- Production WebGL view-matrix capture: **1,646 frames over 23 seconds** including
  a complete two-shot run. Largest adjacent translation **0.0416 m**; peak sampled
  camera speed **2.492 m/s**; largest adjacent heading change **1.102°**. These are
  bounded local measurements, not a frame-rate or thermal guarantee for every device.
- Actual `TennisScene` checks: **336 render samples** across all **16 bundled drills**
  (up to four events each) and one custom sequence. Contact boundaries, travel starts,
  midpoints and ends match the absolute camera plan to floating-point tolerance
  (maximum difference below 1e-12). Manual inspection-camera opt-out also passes.

## Review fixes

The browser review exposed a faint/clipped return outline and phone timeline
overflow; the outline, overview and grid containment were corrected. Numeric view
fields now show readable precision. An additional regression reproduced a 108°
single-frame jump when an authored backward view crossed a tracking-angle branch;
the fade now uses a fixed branch and reserves gaze-turn time. The regression passes.

Test-harness issues were kept separate from app failures: lazy route checks needed
to wait for the editor, completed drills use the completion dialog, and the old
MotionLab dev server held stale modules. A temporary fresh runtime server was used
for renderer verification and stopped afterward.

## Local artifacts

Artifact directory:
`C:\Users\20378\.codex\visualizations\2026\09\08\01a07e7c-7199-7900-ab83-f0437137320b\drill-camera-editor`

It contains `editor-browser-result.json`, `rendered-camera-result.json`,
`production-camera-frames.json`, `configured-drill.json`, the editor/return-space/
phone screenshots, three actual camera-transition frames, and the two reproducible
Playwright scripts. Screenshots were inspected alongside the numerical evidence.
