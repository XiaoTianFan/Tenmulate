# ADR-0035: Court-space returns and shot-library editing

- Status: Accepted for local implementation
- Date: 2026-09-09
- Supersedes: ADR-0022's camera-relative return rectangle and fixed next-opponent contact; retains its continuous camera timeline

## Decision

Each drill event may author `returnLandingZone`, a rectangle in meters on the
opponent's singles half (positive z). It describes the intended first bounce of
the pseudo-return from that event, which supplies the following event's incoming
ball. Defaults are 1.6 m wide by 2 m deep, centered at x=0, z=8. Both dimensions
support 0.2–6 m, bounded by the court. A volley or overhead intercepts the flight
before its projected bounce.

The compiler samples this rectangle from an independent seeded stream. It selects
a legal contact on the resolved incoming flight, favoring a comfortable post-bounce
contact. Camera position/yaw never translates or limits this return space. A bounded
pace/contact search uses the existing aerodynamic and bounce solver, rotated into
the opposite court half. Candidate trials retain the same sampled bounce target.
No visual endpoint snap, flight warp or time stretch is allowed.

The next opponent contact is an eligible sample on that return flight. The next
outgoing trajectory resolves from this exact position. The interval-first rhythm
solver and shared recovery planner check travel/preparation against the physical
arrival clock, selecting a direct approach or a neutral recovery as time permits.
Camera travel still starts after the pseudo-return contact, tracks the opponent,
and ends before the next stroke. Impossible links remain explicit new feeds;
rests and new serves break rallies. Initial/new feeds use family defaults. Legacy
event `opponentPosition` and drill `returnZone` remain importable, but no longer
drive drill playback. Quick Practice retains its home-position and coverage rules.
Planner identity is `gameplay-return-zones-v9`; motion assets are unchanged.

The editor has a type-filtered default/saved shot library and a bottom event
timeline. Dragging inserts or reorders, right-click/Delete removes, and Undo
restores the event. Empty timelines may be edited but cannot be saved or played.
Saved presets capture both zones, camera, ball/timing and opponent hand/stroke;
explicit new/update actions preserve independent event copies.

Two persistent scene controls edit the incoming zone in yellow and return zone
in blue. Meshes update during movement; compilation runs on release. The centered
top-down view fits both halves to the canvas aspect ratio and never overwrites
the authored shot camera. WASD/Shift and Page Up/Down preview camera movement at
frame rate and commit one undoable gesture; text inputs/dialogs retain their keys.
Ball sliders share Quick Practice's control, committing editor gestures on release.
Perspective follows Ball & rhythm. All modes retain the shared renderer.

## Evidence and boundaries

Numerical checks cover deterministic target sampling, both exact handoffs, zone
validation/persistence, camera independence, movement continuity and existing
camera limits. Actual mannequin checks cover both hands at the new contacts.
The [implementation receipt](../development/editor-return-zones-2026-09-09.md)
records browser acceptance, remaining limitations and local commit stages.
Local verification is separate from owner acceptance and public deployment.
