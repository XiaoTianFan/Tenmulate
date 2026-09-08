# ADR-0020: Shared court lifetime and transactional zone editing

- Status: Accepted for local implementation
- Date: 2026-09-08
- Supersedes: The translation-only gesture contract in ADR-0019 and route-owned renderer lifetimes.

`SharedCourtProvider` owns one stable portal container and `SceneViewport` for
Practice, Editor and rehearsal playback. Routes supply a viewport slot and current
configuration. Navigation moves the existing container; it does not recreate the
canvas, `TennisScene`, WebGL context, opponent or unchanged venue assets. Routes
without a court park the container and stop its animation loop. Document hiding
also suspends rendering. Re-entering a court resizes and resumes that scene.
An explicit venue or quality change may still replace the selected venue asset.

The landing-zone interior remains a court-plane move target. Its four sides and
four corners provide anchored resizing: a side changes one dimension, a corner
changes both, and the opposite bounds stay fixed. Small rendered grips appear on
hover/selection; screen-distance hit tolerance supports oblique views and touch.
The center retains a move region even when projected zones are small. The existing
court/service bounds and 0.2–6 m dimension limits constrain the edit.

Each gesture is a transaction. Pointer motion changes only the zone's scene
geometry, retaining the initial bounds and grab offset. It does not publish React
settings, fit trajectories, compile future feeds or append editor undo entries.
Release publishes one complete rectangle; cancellation restores the current model.
The draft remains visible until the compiled session acknowledges it. The previous
actual-bounce marker is hidden while this draft is pending. Camera and zone
gestures retain their initial ownership until release/cancellation. Numeric fields
continue to provide direct dimension entry.

The shipped corner camera positions move to 2.8 m behind the baseline and 3.6 m
laterally from center. The volley position is centered 1 m toward the net from the
service T. These three position presets also aim at the opposite baseline center;
the chosen FOV remains independent. An optional `lookAt` field encodes that target.
Only exact untouched legacy built-ins migrate; custom or edited positions survive.

Uniform sampling, continuous setup preview, finite launched sets and the motion
asset contract retain their ADR-0018/0019 behavior. Evidence and limits are in the
[shared-court and resizing receipt](../development/shared-court-and-zone-resize-2026-09-08.md).
