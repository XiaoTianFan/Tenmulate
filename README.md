# Tenmulate

Tenmulate is the working title for a browser-based, first-person tennis visualization tool. It will place a player at a calibrated on-court point of view and play realistic incoming ball trajectories for shadow swinging, return preparation, and tactical mental rehearsal.

The repository is currently in discovery and planning. It contains no application implementation yet. The first implementation gate is an approved V1 product scope and visual concept, followed by a renderer and trajectory proof of concept.

## Provisional direction

- React, TypeScript, and Vite for the application shell.
- Three.js for the 3D runtime, starting with a benchmark of `WebGPURenderer` and its WebGL 2 backend against the mature `WebGLRenderer` path.
- A tennis-specific, fixed-step ball-flight solver using gravity, aerodynamic drag, Magnus lift, and calibrated bounce response.
- A layered asset pipeline: exact/procedural gameplay geometry in Three.js, cloud-generated but project-hosted venue shells where they pass the bake-off, game-realistic skinned opponents delivered as optimized GLB, and Blender as the canonical cleanup, retargeting, validation, and export environment.
- A complete public-free V1 with local-first settings, full drill authoring, all requested shot families, and no runtime camera capture or body tracking.

These are proposed decisions, not irreversible commitments. The acceptance gates are recorded in the architecture decision record.

## Documentation

| Document | Purpose |
| --- | --- |
| [Documentation index](docs/README.md) | How the planning record is organized and maintained |
| [Product requirements](docs/product-requirements.md) | Draft PRD, scope, requirements, and release criteria |
| [Technical architecture](docs/technical-architecture.md) | Simulation, rendering, animation, data, and test design |
| [Technology research](docs/research/technology-options.md) | Current option comparison and primary-source research |
| [AI 3D tool market map](docs/research/ai-3d-asset-tools-2026.md) | August 2026 Chinese and international asset/mocap options and bake-off plan |
| [Cloud world-generation research](docs/research/world-generation-and-scene-reconstruction-2026.md) | Aholo, Marble, splat/mesh integration, coordinate registration, and the sub-US$100 experiment |
| [Mocap-to-web character pipeline](docs/research/mocap-to-web-character-pipeline.md) | Mesh/rig/skin/animation definitions, retargeting, tennis cleanup, formats, and rights gate |
| [Court environment concepts](docs/concepts/court-environment-concepts-2026-08.md) | Bird's-eye and player-level boards for owner art-direction review |
| [Scene-generation prompt kit](docs/concepts/scene-generation-prompt-kit.md) | Three reusable perspective prefixes and six standalone court/environment prompts |
| [Opponent character 01](docs/concepts/opponent-character-01.md) | First fictional right-handed male design sheet and detachable-racket production guidance |
| [Application UI concepts](docs/concepts/application-ui-concepts-2026-08.md) | Complete setup, rehearsal, and timeline-editor implementation references |
| [Roadmap](docs/roadmap.md) | Milestones, gates, deliverables, and validation order |
| [Open questions](docs/open-questions.md) | Decisions that need owner input or prototype evidence |
| [ADR-0001](docs/decisions/0001-web-rendering-and-simulation-architecture.md) | Proposed initial web/rendering/simulation architecture |
| [ADR-0002](docs/decisions/0002-v1-scope-and-release-model.md) | Accepted V1 scope, audience, release, and V2 boundary |
| [ADR-0003](docs/decisions/0003-hybrid-asset-authoring-strategy.md) | Proposed procedural/GLB asset-authoring strategy |
| [ADR-0004](docs/decisions/0004-generated-world-environment-layer.md) | Proposed generated-world environment-shell strategy |

## Current status

- Repository initialized: complete.
- Research and planning baseline: drafted on 2026-08-29.
- Product-owner clarification: V1 boundary and audience accepted on 2026-08-29.
- AI 3D, cloud mocap, and world-generation market reviews: researched on 2026-08-29; comparative bake-offs pending.
- Court environment directions: six accepted on 2026-08-29; outdoor Panel 1 selected as the product and vertical-slice baseline.
- First opponent concept sheet: generated on 2026-08-29; owner/rigging review pending.
- Setup, rehearsal, and timeline-editor visual concepts: generated on 2026-08-29 and adopted as the implementation reference.
- Technical proof of concept: not started.
- Production implementation or deployment: not started.
