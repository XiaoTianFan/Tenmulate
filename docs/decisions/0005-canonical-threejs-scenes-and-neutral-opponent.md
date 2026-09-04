# ADR-0005: Canonical Three.js scenes and neutral mocap opponent

- **Status:** Accepted
- **Date:** 2026-08-30
- **Decision owners:** Project owner and implementation lead
- **Supersedes:** ADR-0003's generated-environment and generated-character assumptions; ADR-0004
- **Extended by:** ADR-0006, which expands the venue catalogue to nine and replaces local texture maps/static skies with procedural shader materials and one dynamic atmosphere
- **Pilot exception:** ADR-0009 permits one opt-in Blender-authored hard-open arena; procedural composition remains the default/fallback pending acceptance.

## Context

The world-generation bake-off established that current Gaussian-splat and generated-world outputs can reproduce the visual mood of a tennis venue but do not provide sufficiently coherent, editable, or approximately valid space for this product. Registration and proxy reconstruction would leave the team rebuilding the meaningful geometry while also paying a substantial transfer, lighting, occlusion, and runtime cost.

The opponent is normally distant. Its job is to communicate preparation, handedness, contact, recovery, and serve rhythm, not facial identity or apparel detail. Mocap compatibility and animation quality therefore matter more than a generated character surface.

## Decision

1. Make code-owned TypeScript/Three.js composition the canonical source for the V1 court environments. ADR-0006 expands the original six-scene set to nine venue identities.
2. Keep regulation court coordinates independent from venue decoration, but model the visible venue itself from reusable typed components: acrylic/clay/grass surfaces, runoff, fences, walls, seating, access paths, club buildings, roof structures, lights, planting, furniture, and court equipment.
3. Use physically based Three.js materials, locally generated texture maps, instancing, authored profiles, layered geometry, calibrated lights, fog/sky treatment, and explicit level-of-detail/quality switches. Do not use Gaussian splats, generated-world meshes, panoramas, or provider-hosted worlds in the runtime.
4. Treat the six accepted concept scenes as art-direction references only:
   - bright outdoor blue/green public-club hard court;
   - Mediterranean terraced clay club at golden hour;
   - landscaped grass park court under night floodlights;
   - timber-and-steel indoor hard-court club hall;
   - indoor clay tournament stadium;
   - contemporary covered grass arena.
5. Keep surface appearance and bounce physics independently selectable. Each scene has an authored default surface and lighting identity, but court physics never derives from the venue.
6. Replace the ball machine only with a rights-cleared, neutral, faceless, low-detail humanoid GLB on a stable humanoid skeleton. Do not generate a bespoke mesh, face, texture binding, or identity.
7. Make the opponent a mocap carrier: separate rigid racket attached to named left/right hand sockets, animation clips retargeted and cleaned in Blender or an equivalent DCC, explicit contact markers, root-motion policy, handedness metadata, and normal/compact serve timing.
8. Keep Blender as an optional validation, retargeting, and GLB-export tool for the neutral opponent and any genuinely complex reusable prop. Blender is not the court-scene source of truth.
9. Preserve generated images and earlier generator research as dated design/research history, not active implementation candidates.

## Rationale

- Code-owned spatial composition preserves metric validity, surface switching, lighting control, deterministic camera corridors, and inspectable geometry.
- Reusable component families let six visually different scenes share tested construction logic without becoming six opaque asset packages.
- PBR materials and procedural/local textures supply visible scale and richness while remaining small, offline-capable, and dynamically relightable.
- A neutral humanoid prevents unnecessary identity, likeness, topology, and texture risk while keeping animation replacement straightforward.
- The approach concentrates effort on what the player can actually read: court scale, ball contrast, contact silhouette, and motion rhythm.

## Consequences

### Positive

- No environment-generation vendor, splat renderer, or world-registration dependency remains.
- Every visible prop and material can respond to live lighting and quality settings.
- Six scenes remain editable, testable, and progressively refinable in the same repository.
- Opponent assets can be swapped without altering drill, trajectory, camera, or scene contracts.

### Negative

- The project owns more modeling, material, composition, and performance-tuning code.
- Achieving game-realistic detail requires repeated visual comparison rather than a one-shot environment import.
- A neutral open-source humanoid still requires license review, skeleton inspection, retargeting, contact cleanup, and browser optimization.

## Acceptance evidence

- Each scene has a typed identity, complete surrounding context, player-level and overview render evidence, and no missing gameplay corridor.
- The Panel 1 scene first approaches its accepted reference in composition, material scale, lighting, and depth before the other scenes are treated as polished.
- All regulation geometry and trajectory tests remain green after scene refactors.
- Scene switching and quality changes do not leak or duplicate GPU resources.
- The selected neutral humanoid has a recorded source/license, compatible skeleton map, separate racket sockets, deterministic animation/contact metadata, and optimized GLB evidence.
- Browser renders at the supported viewports pass concept-to-render review with actual frame-time and console evidence.
