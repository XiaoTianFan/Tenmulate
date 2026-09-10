# Camera transition editor — 2026-09-10

## Using the editor

Select a narrow camera column between two shots. The inspector edits that interval;
the normal shot columns still edit their contact views and ball settings.

**Movement** offers Automatic, Recover to neutral, Direct to next shot, and Via a
custom position. Explicit routes let you choose when to depart and, for recovery
or an intermediate stop, when to continue: Automatic, after your shot, at opponent
contact, or after the split step. Each can have a 0–2 s delay. Automatic pace uses
the drill/shot preference; an override covers 50–200%. The fit can accelerate a
route within the existing speed and acceleration bounds to make the next contact. A
route requiring too much travel time is reported instead of teleporting or
silently omitting its intermediate stop.

**Focus** has separate choices before and after opponent contact: Automatic,
Ball only, Opponent only, Next shot direction, Fixed direction, or Court point.
Automatic keeps the existing tennis attention model. Explicit Ball only can pan
away from the opponent. Switching targets blends at contact, including across the
±180° angular boundary. All choices yield to the next authored contact view before
the player hits. The endpoint is still the camera configured on that shot.

While editing a transition, use WASD/Page Up/Page Down, drag to pan and wheel to
zoom. **Capture position** stores position and eye height; **Capture direction**
stores yaw/pitch. These operations leave shot contact cameras intact. View saved
position/direction restores that part of the temporary editor view. A Court point
can be captured from the view ray or adjusted on three coordinate sliders.
Top-down view cannot be captured as a player-height waypoint. Zoom applies to all
shots and is never animated by the transition.

**Preview this transition** plays from the selected shot's actual contact to the
next contact and returns to editing. **Preview sequence** plays the whole drill.
**Reset to automatic** removes both movement and focus overrides. Saving or updating
a shot preset includes its transition. Reordering carries the transition with its
preceding shot and resolves its destination against the new next shot. A final
shot keeps its transition for reuse without playing an extra shot. Separate points
also expose a camera interval; their Automatic movement keeps the existing reset
before the new opening feed.

One intermediate stop and two attention stages are supported per interval. This
is intentional staged authoring, not an arbitrary animation-keyframe editor.
The timing controls cannot override physical ball/contact constraints. Explicit
position or timing combinations can still be infeasible, which disables sequence
playback with a planning message while leaving isolated shot editing available.

## Implementation and validation

The schema-V2 optional `cameraTransition` is defined in `src/content/types.ts`.
Missing data means Automatic. Strict validation, snapshot/load and mirroring
preserve values; waypoint x, direction yaw and focus-point x mirror, while the
opponent's configured hand remains intact. The planner is
`gameplay-player-drills-v14`; ball physics and motion assets are unchanged.
[ADR-0042](../decisions/0042-configurable-camera-transitions.md) supersedes only the
automatic-only policy in ADR-0041.

All **530 tests across 48 files**, the production build and active motion/cache
guard pass. The existing bundle-size advisory remains. Camera tests cover automatic equivalence, departure/delay,
waypoint holds, pace on both legs, speed/acceleration bounds, infeasible routes,
focus-only timing independence, actual outgoing/incoming ball targets, contact
continuity, backward-angle pans, new-point resets, strict malformed-data rejection,
preset persistence and exact handedness round trips.

Thirty production Edge checks at 1680×1000 and 390×844 cover narrow selection,
WASD/pan capture, independent coordinates/direction, unchanged contact cameras,
top-down capture exclusion, transition/full playback, actual gameplay, fixed zoom,
mounted-court identity, saving, reload, overwrite, mirroring, reorder, shot removal,
Automatic reset and mobile overflow. Twenty actual Three.js frames cover a custom
waypoint in both hands, direct travel with ball focus, and new-point travel with
point/direction focus. Each matches the pure compiled camera exactly and has zero
WebGL errors. Desktop/mobile controls and representative rendered frames were
visually inspected; no browser runtime/console errors were recorded.
Final responsive checks at 1680×1000, 1080×898 and 390×844 also verify that long
transition titles do not overlap the canvas tools/legend and that the controls
fit without horizontal page overflow.

Evidence scripts, JSON and screenshots are in
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/camera-transition-editor/`.
`verify.mjs` is the main production UI probe, `persistence.mjs` exercises stored
settings and gameplay, and `render.mjs` measures actual Three.js frames. Isolated
Edge contexts use no owner browser data. The owner's existing 5173 server/tab is
preserved. This is local implementation and verification, not public deployment
or owner acceptance of every custom camera configuration's comfort.
