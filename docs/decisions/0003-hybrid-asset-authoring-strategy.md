# ADR-0003: Hybrid procedural and GLB asset-authoring strategy

- **Status:** Superseded by ADR-0005
- **Date:** 2026-08-29
- **Decision owners:** Project owner and implementation lead

## Context

The court must be dimensionally exact, configurable, small to deliver, and straightforward to validate. The game-realistic opponent must support skinning, left- and right-handed variants, normal/compact serve rhythms, footwork, rackets, and a large animation library. Direct Three.js geometry, Blender-authored GLB, licensed assets, generative tools, and procedural modeling each solve different parts of this problem.

## Historical proposal

The owner replaced the generated-character and generated-environment bake-off direction on 2026-08-30. ADR-0005 is authoritative: court environments are canonical Three.js compositions, and the opponent is a neutral rights-cleared humanoid selected for mocap compatibility rather than generated appearance.

1. Create regulation court geometry, lines, net structure/mesh, ball, targets, trajectory/debug layers, and simple modular venue primitives directly in TypeScript/Three.js from tested parameters.
2. Deliver game-realistic opponents, rackets, complex props, and authored animations as optimized GLB assets.
3. Make Blender the canonical finishing and editable source-of-truth environment for every complex asset, regardless of whether its starting source is Tripo, Meshy, Lux3D, Hunyuan/VISVISE, Rodin, a licensed marketplace asset, a scan, or a commissioned artist.
4. Select generation/rigging/motion providers only after the standardized tennis bake-off in the August 2026 AI 3D research note.
5. Include Tripo, Meshy, Lux3D, Hunyuan3D + VISVISE, Rodin + a motion specialist, and a licensed/commissioned baseline in the candidate set.
6. Use vendor APIs, Blender extensions, MCP servers, agent skills, and Blender MCP only during development. V1 runtime never calls a 3D-generation or mocap service.
7. Ship assets through versioned manifests, optimized GLB geometry, KTX2/Basis textures, separate/lazy animation bundles where practical, immutable CDN/static caching, and service-worker-selected offline groups.
8. Preserve per-asset provenance: inputs/consent, provider/model/version, prompts/settings, generation receipts, source and output licenses, `.blend`, export preset, cleanup notes, and shipped hashes.

## Rationale

- Code generation gives exact court geometry, tiny payloads, theme flexibility, and deterministic tests.
- GLB is designed for runtime transmission and supports PBR, skins, skeletons, morphs, and animations.
- Game-realistic human deformation and tennis motion require DCC/rigging tools; implementing them as raw Three.js geometry is not a productive substitute.
- Blender provides one cleanup/retarget/export gate even while upstream tools evolve.
- The same final runtime files remove cloud-versus-local generation from the player's loading/performance path.
- A bake-off measures the hidden cost of failed generations, cleanup, rigging, contact repair, and web optimization.

## Alternatives considered

### Everything modeled directly in Three.js

Appropriate for the court and primitives, but not for a production humanoid, clothing, topology, weight painting, or a tennis animation library. It would shift DCC work into fragile bespoke code while retaining equivalent GPU mesh cost.

### Everything authored in Blender

Viable, but makes exact court customization and simple debug/training geometry unnecessarily asset-bound. It also prevents code-level dimension assertions from being the single authority.

### One vendor end to end

Fastest if the result happens to pass, but creates quality, terms, version, and service lock-in before tennis-specific evidence exists. Keep one-vendor routes in the bake-off without assuming they win.

### Runtime AI generation

Out of V1 scope. It adds latency, cost per user, moderation, privacy, reliability, licensing, and unpredictable performance while providing little value to a curated training product.

## Consequences

### Positive

- Exact regulation geometry stays small and testable.
- Opponent quality can improve without changing simulation contracts.
- Asset generators remain replaceable production inputs.
- Public sessions depend only on static runtime files, not generator availability.

### Negative

- The team must maintain Blender export/optimization, manifests, provenance, and an asset validator.
- Animation bundles and variants still require careful compatibility/version management.
- Agent/Blender automation expands the security and credential-review surface during development.

## Acceptance evidence required

This ADR becomes Accepted only when:

- the code-generated court passes dimension and visual review;
- at least Tripo, Meshy, Lux3D, one Hunyuan/VISVISE path, and a licensed/commissioned baseline have comparable results or a documented reason they could not be evaluated;
- one opponent with right-handed forehand, backhand, normal serve, and ready/footwork/recovery connector clips passes rig, skin, contact, blending, and Blender-to-GLB round-trip review; compact serve remains the next V1 motion-family test;
- the first-drill cold/warm byte, load, decode, memory, and frame-time budgets pass in WebGPU and WebGL fallback paths;
- asset provenance and license records are complete;
- any proposed MCP/plugin has a recorded publisher, source/version, credentials, network/telemetry, arbitrary-code, and cost-confirmation review.

If a single source or an all-Blender path wins on measured total cost and quality, supersede this ADR instead of preserving the hybrid for ideological reasons.
