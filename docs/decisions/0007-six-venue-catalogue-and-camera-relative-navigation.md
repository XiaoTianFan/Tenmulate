# ADR-0007: Six-venue catalogue and camera-relative navigation

- **Status:** Accepted
- **Date:** 2026-08-31
- **Supersedes:** ADR-0006 only for venue count, catalogue membership, and visible venue naming

## Context

The nine-venue catalogue mixed three smaller outdoor club/park scenes with three substantially more complete outdoor arenas. This made the outdoor choices inconsistent in both visual scope and naming, while the three indoor halls already formed a coherent hard/clay/grass family. Camera translation also remained tied to the court axes after the camera gained free 360-degree yaw, so forward input could disagree with the direction the user was facing.

## Decision

1. Ship exactly six venue identities: `Outdoor Arena · Hard`, `Outdoor Arena · Clay`, `Outdoor Arena · Grass`, `Indoor Court · Hard`, `Indoor Court · Clay`, and `Indoor Court · Grass`.
2. Remove the outdoor club, clay terrace, and grass park builders from the runtime. Migrate those stored identifiers to the arena with the same surface; migrate the older generic `outdoor` identifier to the hard outdoor arena.
3. Keep the retained internal venue identifiers stable so existing arena and indoor preferences do not churn. Court geometry, surface selection, atmosphere ownership, weather, wind, and procedural-material decisions remain unchanged.
4. Interpret ordinary WASD in the active camera-yaw frame. W/S move forward/backward along the horizontal facing vector and A/D strafe along its perpendicular; pitch does not alter translation height.
5. Interpret Ctrl+W/S as eye-height input instead of horizontal forward/backward input, clamped from 0.4 m through 8.0 m. Ctrl+A/D may continue to strafe. Shift acceleration and frame-rate-independent held-key behavior remain unchanged.

## Verification contract

- The canonical registry contains exactly six definitions with one uniform setting/surface label template.
- Removed stored venue identifiers normalize to the corresponding retained arena.
- Only the hard outdoor arena starts visible; every retained group remains independently selectable.
- Unit tests cover forward and strafe movement at 0°, +90°, and -90° yaw, diagonal normalization, and horizontal-drift-free Ctrl+W/S height movement.
- Browser review confirms the six labels, camera-facing translation, height adjustment, and absence of console errors at the supported setup layout.
