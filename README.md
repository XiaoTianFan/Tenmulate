# Tenmulate

Tenmulate is a browser-based, first-person tennis visualization tool. It places a player at a calibrated on-court point of view and plays configurable incoming ball trajectories for shadow swinging, return preparation, and tactical mental rehearsal.

The repository contains the active V1 implementation: a deterministic Three.js court/ball simulation, complete starter shot library, rehearsal player, local drill editor, independently customizable camera-position and perspective presets, validated JSON exchange, and offline-capable app shell. Court environments now follow a canonical code-owned Three.js modeling pipeline. A compact CC0 neutral humanoid is integrated as the mocap carrier, with the ball machine retained only as its load-failure fallback.

## Implemented direction

- React, TypeScript, and Vite for the application shell.
- Three.js `WebGLRenderer` with WebGL 2 for the V1 runtime, isolated behind a typed scene adapter; WebGPU remains a later production-asset benchmark.
- A tennis-specific, fixed-step ball-flight solver using gravity, aerodynamic drag, Magnus lift, and calibrated bounce response.
- A code-owned visual pipeline: six reusable Three.js venue compositions with PBR/procedural materials and live lighting, plus one neutral faceless humanoid delivered as an optimized GLB mocap carrier. Blender is limited to rig/animation validation, retargeting, and export where needed.
- A complete public-free V1 with local-first settings, full drill authoring, all requested shot families, and no runtime camera capture or body tracking.

The renderer and simulation decision is accepted for V1. Production 3D assets, device/browser validation, and public hosting still have explicit release gates.

## Documentation

| Document | Purpose |
| --- | --- |
| [Documentation index](docs/README.md) | How the planning record is organized and maintained |
| [Product requirements](docs/product-requirements.md) | Draft PRD, scope, requirements, and release criteria |
| [Technical architecture](docs/technical-architecture.md) | Simulation, rendering, animation, data, and test design |
| [Technology research](docs/research/technology-options.md) | Current option comparison and primary-source research |
| [AI 3D tool market map](docs/research/ai-3d-asset-tools-2026.md) | August 2026 Chinese and international asset/mocap options and bake-off plan |
| [Cloud world-generation research](docs/research/world-generation-and-scene-reconstruction-2026.md) | Historical Aholo/Marble/splat evaluation; rejected for production by ADR-0005 |
| [Mocap-to-web character pipeline](docs/research/mocap-to-web-character-pipeline.md) | Mesh/rig/skin/animation definitions, retargeting, tennis cleanup, formats, and rights gate |
| [Neutral opponent asset record](docs/assets/quaternius-neutral-opponent.md) | Exact CC0 source, normalization, hashes, skeleton/socket contract, and remaining mocap gates |
| [Court environment concepts](docs/concepts/court-environment-concepts-2026-08.md) | Bird's-eye and player-level boards for owner art-direction review |
| [Scene-generation prompt kit](docs/concepts/scene-generation-prompt-kit.md) | Four reusable perspective prefixes, including a 360-degree panorama, and six standalone court/environment prompts |
| [Opponent character 01](docs/concepts/opponent-character-01.md) | First fictional right-handed male design sheet and detachable-racket production guidance |
| [Application UI concepts](docs/concepts/application-ui-concepts-2026-08.md) | Complete setup, rehearsal, and timeline-editor implementation references |
| [Implementation status](docs/development/implementation-status.md) | Staged V1 code coverage, verification evidence, and remaining gaps |
| [Visual verification](docs/development/visual-verification.md) | Concept-to-browser fidelity ledger for each implementation stage |
| [V1 release matrix](docs/development/v1-release-matrix.md) | Requirement-by-requirement implementation evidence and external release gates |
| [Roadmap](docs/roadmap.md) | Milestones, gates, deliverables, and validation order |
| [Open questions](docs/open-questions.md) | Decisions that need owner input or prototype evidence |
| [ADR-0001](docs/decisions/0001-web-rendering-and-simulation-architecture.md) | Accepted V1 web/rendering/simulation architecture |
| [ADR-0002](docs/decisions/0002-v1-scope-and-release-model.md) | Accepted V1 scope, audience, release, and V2 boundary |
| [ADR-0003](docs/decisions/0003-hybrid-asset-authoring-strategy.md) | Superseded generated-asset strategy |
| [ADR-0004](docs/decisions/0004-generated-world-environment-layer.md) | Superseded generated-world environment-shell strategy |
| [ADR-0005](docs/decisions/0005-canonical-threejs-scenes-and-neutral-opponent.md) | Accepted canonical Three.js scene and neutral mocap-opponent pipeline |

## Current status

- Repository initialized: complete.
- Research and planning baseline: drafted on 2026-08-29.
- Product-owner clarification: V1 boundary and audience accepted on 2026-08-29.
- AI 3D and world-generation market reviews: retained as 2026-08-29 history; generated meshes/splats are no longer production candidates. Mocap-provider testing remains relevant.
- Court environment directions: six accepted on 2026-08-29; outdoor Panel 1 selected as the product and vertical-slice baseline.
- First opponent concept sheet: generated on 2026-08-29; owner/rigging review pending.
- Setup, rehearsal, and timeline-editor visual concepts: generated on 2026-08-29 and adopted as the implementation reference.
- Technical implementation: the complete local V1 is runnable, automated-tested, browser-verified, offline-capable, responsive, and performance-adaptive. Six authored venues and the neutral opponent carrier now run in-browser; tennis mocap, racket/contact review, device validation, and public-release operations remain open.
- Production deployment: not started.
