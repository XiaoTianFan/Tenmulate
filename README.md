# Tenmulate

Tenmulate is the working title for a browser-based, first-person tennis visualization tool. It will place a player at a calibrated on-court point of view and play realistic incoming ball trajectories for shadow swinging, return preparation, and tactical mental rehearsal.

The repository is currently in discovery and planning. It contains no application implementation yet. The first implementation gate is an approved V1 product scope and visual concept, followed by a renderer and trajectory proof of concept.

## Provisional direction

- React, TypeScript, and Vite for the application shell.
- Three.js for the 3D runtime, starting with a benchmark of `WebGPURenderer` and its WebGL 2 backend against the mature `WebGLRenderer` path.
- A tennis-specific, fixed-step ball-flight solver using gravity, aerodynamic drag, Magnus lift, and calibrated bounce response.
- Blender as the canonical asset-cleanup, rigging, animation, and glTF/GLB export tool.
- Local-first drills and settings in V1; no account, backend, camera capture, or body tracking in the initial release.

These are proposed decisions, not irreversible commitments. The acceptance gates are recorded in the architecture decision record.

## Documentation

| Document | Purpose |
| --- | --- |
| [Documentation index](docs/README.md) | How the planning record is organized and maintained |
| [Product requirements](docs/product-requirements.md) | Draft PRD, scope, requirements, and release criteria |
| [Technical architecture](docs/technical-architecture.md) | Simulation, rendering, animation, data, and test design |
| [Technology research](docs/research/technology-options.md) | Current option comparison and primary-source research |
| [Roadmap](docs/roadmap.md) | Milestones, gates, deliverables, and validation order |
| [Open questions](docs/open-questions.md) | Decisions that need owner input or prototype evidence |
| [ADR-0001](docs/decisions/0001-web-rendering-and-simulation-architecture.md) | Proposed initial web/rendering/simulation architecture |

## Current status

- Repository initialized: complete.
- Research and planning baseline: drafted on 2026-08-29.
- Product-owner clarification: pending.
- Visual concept and interaction design: pending approval of the core usage assumptions.
- Technical proof of concept: not started.
- Production implementation or deployment: not started.
