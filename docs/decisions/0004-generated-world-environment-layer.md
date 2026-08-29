# ADR-0004: Treat generated worlds as registered environment shells

- **Status:** Proposed
- **Date:** 2026-08-29
- **Decision owners:** Project owner and implementation lead
- **Related:** ADR-0001, ADR-0003, cloud world-generation research

## Context

V1 requires complete game scenes, not a floating court: outdoor, walled indoor-club, and indoor-stadium contexts; hard, clay, and grass surfaces; seating, umpire/rest chairs, and configurable lighting. Cloud world generators may create these surroundings much faster than hand-modeling everything, and Gaussian splats can retain convincing environmental detail.

The tennis experience also requires stable SI coordinates, regulation geometry, exact ball and camera paths, deterministic replay, surface swapping, depth/occlusion, shadows, and live day/night or light-direction controls. Current world outputs cannot be assumed to satisfy those requirements directly.

## Proposed decision

1. Keep the exact court, lines, net, ball, target/debug geometry, opponent placement, and all simulation coordinates code-owned in Three.js.
2. Permit a cloud-generated world only as a **registered visual environment shell** around that exact layer.
3. Require every environment to export to a project-hosted asset: optimized PBR GLB for the default path, or PLY/SPZ plus proxy mesh for a Gaussian-splat experiment. Provider-hosted iframes and runtime inference are excluded.
4. Record a versioned `worldToCourt` transform, anchors, bounds, crop/mask volume, proxy geometry, lighting mode, LOD/byte data, and provenance in the venue manifest.
5. Prefer a PBR mesh shell for V1's fully configurable sun/day/night behavior. Treat splats as an experimental visual path until proxy relighting, depth composition, 4K performance, browser fallback, and offline caching pass.
6. Compare Aholo SpatialGen/Reality, World Labs Marble, and the procedural/modular control using the same approved court concept and evidence matrix.
7. Build three venue shells—outdoor, indoor club hall, indoor stadium—and combine each with the three exact code-owned surface themes. Do not duplicate an entire generated world solely to change the playable surface.
8. Keep the total initial world, character, and motion bake-off below US$100. No automatic renewal or paid retry without a recorded hypothesis.

## Rationale

- World generation can save environment-authoring time without weakening tennis geometry.
- A swappable exact court yields all nine venue/surface combinations from three environment shells.
- Meshes integrate more naturally with live PBR lighting and the proposed WebGPU path.
- Splats can provide unusually rich fixed ambience, but baked lighting, transparent sorting, depth, proxy geometry, and renderer compatibility make them an evidence-gated option.
- Self-hosted immutable exports preserve offline behavior, versioning, availability, and cost control.

## Consequences

### Positive

- Venue-generation vendors remain replaceable.
- The simulation and authored drills never depend on inferred world coordinates.
- Surface, lighting, and quality controls remain product features rather than generator limitations.
- A generated shell can be downgraded or removed without changing gameplay.

### Negative

- Generated worlds still require registration, cropping, proxy/depth geometry, optimization, and provenance work.
- The most photorealistic splat may not support the best live lighting or WebGPU path.
- “One-click world” does not mean one small runtime download; asset streaming and caching remain necessary.

## Rejected alternatives

### Use the generated court as the simulation authority

Rejected because inferred dimensions, net placement, line markings, colliders, and scale are not sufficiently deterministic or testable.

### Stream an interactive video world model during practice

Rejected because it cannot guarantee stable geometry, frame timing, ball occlusion, camera coordinates, deterministic replay, offline use, or bounded operating cost.

### Require all venues to be hand-modeled before a vertical slice

Rejected as premature. A cloud-generated shell may provide a much faster visual baseline, and the bake-off will measure whether its cleanup cost is actually lower.

## Acceptance evidence

This ADR can become Accepted when one environment candidate:

- registers to the exact court within agreed scale/orientation tolerances;
- preserves the opponent/ball visibility corridor at all required camera presets;
- supports or honestly bounds the required lighting controls;
- composes correctly with meshes, shadows, depth, and transparent objects;
- passes WebGPU/WebGL/browser testing or documents a justified renderer choice;
- meets cold/warm transfer, decode, memory, offline, and 60 fps targets at 1080p plus an adaptive 4K path;
- has complete source/output commercial rights and project-hosted redistribution permission;
- costs less in total generation plus cleanup time than the procedural control at comparable accepted quality.
