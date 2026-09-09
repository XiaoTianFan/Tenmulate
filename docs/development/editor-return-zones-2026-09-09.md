# Drill editor and return landing zones — 2026-09-09

Contract: [ADR-0035](../decisions/0035-court-space-returns-and-shot-library-editor.md).
Planner/data stage committed as `61b2d52`; authoring and rendering follow as a
separate focused local commit.

## Stage 1: Return planning and preset data

- Per-event opponent-side return rectangles replace camera-relative footprints.
- The returned ball begins on the incoming trajectory; the next emitter is a
  physical intercept of that return. A seeded sampled bounce remains fixed
  throughout bounded candidate searches. Accepted flights alone are trimmed.
- The shared interval/recovery solver reserves travel and preparation. New feeds
  remain explicit when a physical rally link cannot fit; rests/serves break links.
- Legacy documents still validate. Their camera-relative/fixed-position fields
  no longer control drill placement. New presets contain explicit zone defaults.
- Focused gameplay, camera, zone, validation and saved-shot checks pass.
- Actual Three.js/mannequin sampling, both hands, two successive return contacts:
  contact error below 0.000001 m; non-root bone-length changes below 0.000001 m.
  Preparation/swing/contact screenshots were inspected. The pelvis retains its
  intentional translation degree of freedom. No motion bundle or source clock changed.
- Representative three-shot compilation measured 200–214 ms in the isolated
  Edge verification page. This is a bounded local measurement, not a device-wide
  performance claim.

## Stage 2: Authoring and rendered verification

The shot library filters by family and default/saved source. Dragging inserts at
the hovered timeline boundary; timeline clips reorder, right-click/Delete removes,
and Undo recovers removed events. Click-to-add and inspector deletion also support
touch/keyboard workflows. Explicit preset update overwrites the selected saved id.

The yellow incoming zone and blue return zone share mesh-based move/edge/corner
resize controls. WASD and ball sliders use draft values during a gesture, then
commit once. Perspective sits after Ball & rhythm. Top-down view is centered on
the court and fits its aspect ratio without altering the saved shot view.

Final verification on the production build in an isolated Edge context:

- All 373 tests across 39 files pass, as do `npm run build` and
  `npm run check:motion`. The build retains the existing large-chunk advisory.
- Family/source filtering, native drag insertion and reordering, right-click
  removal, Undo, and the final-event empty state pass. Empty drills cannot run.
- WASD moves the camera; typing in a field does not. Holding WASD or dragging
  either zone performs no session recompilation during the gesture.
- Both zone interiors and corners drag/resize; exports preserve the near-side
  incoming rectangle and opponent-side return rectangle. The centered overview
  fits both rectangles in the rendered frame.
- Saving a new shot, updating its existing id, reloading, and reusing it preserve
  both zones, camera and ball settings. The overwrite was verified with 91 km/h.
- The renderer instance remains the same through editor operations and Test drill.
  Desktop, top-down and 390 px mobile layouts were inspected; mobile has no
  horizontal page overflow. No browser runtime errors were recorded.

The broad checks also caught and fixed an empty-editor selection error and a
default-volley stroke-side regression after automatic opponent positioning. Shot
side now resolves from the authored template before world-position resolution.

Evidence directory (outside the repository):
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/editor-return-zones/`.
`return-rig-qa.mjs` / `return-rig-results.json` record actual rendered contacts;
`editor-qa.mjs` exercises authoring and persistence. Its coordinate sampling waits
for the renderer's one-second diagnostic snapshot, rather than mistaking stale
diagnostic coordinates for a drag failure.
Final UI captures are `editor-desktop.png`, `editor-top-down.png`,
`editor-mobile.png` and `editor-drill-playback.png`. Both-hand approach, swing and
contact frames accompany the rig results.

The local preview repeats the selected shot to edit its outgoing and return zones.
Test drill is the full sequence and resolves contacts from the preceding event.
Owner acceptance and public deployment have not been claimed.
