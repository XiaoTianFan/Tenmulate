# Tenmulate

Tenmulate is a browser-based, first-person tennis visualization tool. It places a player at a calibrated on-court point of view and plays configurable incoming ball trajectories for shadow swinging, return preparation, and tactical mental rehearsal.

The repository contains the active V1 implementation: a deterministic Three.js court/ball simulation, complete starter shot library, rehearsal player, local drill editor, independently customizable camera-position and perspective presets, validated JSON exchange, and offline-capable app shell. All six built-in court environments use Blender-authored assets with Quality/Performance variants. A 1.88 m CC0 articulated mannequin runs the 25-clip tennis library, including normal/compact serves and a distinct backhand overhead, in actual gameplay. The ball machine remains the opponent load-failure fallback.

Quick Practice and drills use editable uniform landing zones. Left-drag the interior
to move, a side to resize one dimension, or a corner to resize both. Drag elsewhere
to look around. The zone previews immediately and recalculates the session once on
release. Practice, Editor and drill playback share one mounted court; the library
parks it without rendering. Setup previews stream fresh feeds continuously;
launched sets honor their chosen repetitions and rests. See the
[shared-court verification receipt](docs/development/shared-court-and-zone-resize-2026-09-08.md).

The drill editor can save complete shot presets and copy them into new sequences.
Each shot stores its opponent, camera, ball and timing settings. Configure your
return-space distance, width and depth in meters; **View return space** shows its
blue footprint beside the yellow landing zone. Playback holds each shot's view,
then follows the opponent while accelerating and braking into the next position.
See the [drill camera and editor receipt](docs/development/drill-camera-and-editor-2026-09-08.md).

**Perspective → Ball focus** keeps approaching balls on a separate sharp layer.
Lens blur varies with each surface's distance from the ball's focus plane; nearby
and distant surfaces soften while that plane stays clear. Set **Maximum blur** directly
under the toggle (0–6 px; default 3). This viewing preference stays shared across
Practice, drill editing and playback, and starts off. See the
[lens-focus verification receipt](docs/development/lens-focus-2026-09-08.md).

## Implemented direction

- React, TypeScript, and Vite for the application shell.
- Three.js `WebGLRenderer` with WebGL 2 for the V1 runtime, isolated behind a typed scene adapter; WebGPU remains a later production-asset benchmark.
- A tennis-specific, fixed-step ball-flight solver using gravity, aerodynamic drag, Magnus lift, and calibrated bounce response.
- A reproducible visual pipeline: Blender source/scripts and optimized GLBs for all six venues, shared dynamic PBR lighting, and a neutral articulated player with reference-authored tennis motions. Gameplay coordinates and simulation remain TypeScript-owned.
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
| [Articulated player](docs/assets/quaternius-articulated-mannequin.md) | Active CC0 model, source/binder and preserved rig contract |
| [Current motion pipeline](docs/development/local-motion-pipeline.md) | 25 clips, reference authoring, normal/compact serves, recovery and gameplay integration |
| [Court environment concepts](docs/concepts/court-environment-concepts-2026-08.md) | Bird's-eye and player-level boards for owner art-direction review |
| [Scene-generation prompt kit](docs/concepts/scene-generation-prompt-kit.md) | Four reusable perspective prefixes, including a 360-degree panorama, and six standalone court/environment prompts |
| [Opponent character 01](docs/concepts/opponent-character-01.md) | First fictional right-handed male design sheet and detachable-racket production guidance |
| [Application UI concepts](docs/concepts/application-ui-concepts-2026-08.md) | Complete setup, rehearsal, and timeline-editor implementation references |
| [Implementation status](docs/development/implementation-status.md) | Staged V1 code coverage, verification evidence, and remaining gaps |
| [Visual verification](docs/development/visual-verification.md) | Concept-to-browser fidelity ledger for each implementation stage |
| [Blender venue pipeline](docs/development/blender-venues.md) | Local DCC/MCP setup, authored hard arena and shared runtime boundary |
| [Clay arena research and build](docs/development/clay-arena.md) | Philippe-Chatrier reference decisions, editable source, export and verification |
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
- Technical implementation: the complete local V1 is runnable, automated-tested, browser-verified, offline-capable, responsive, and performance-adaptive. Six authored venues and the articulated player with tennis strokes, both serve rhythms, recovery and movement run in-browser. Final technique, target-device/owner acceptance and public-release operations remain open.
- Production deployment: not started.

## Run locally

Install with `npm ci`, then `npm run dev` (default `http://127.0.0.1:4173/`).
For this motion review use `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`.
Run `npm test` and `npm run build`; the build also verifies the selected motion asset and offline cache.

Use **Return → Opponent → Serve rhythm** to choose Normal or Compact.
Groundstroke/slice/volley/overhead selection uses the same mannequin and movement controller.
**Stroke rhythm** (50–150%) controls stroke playback independently of shot interval, movement pace and ball speed.
Quick Practice returns to its selected home; drills recover or move directly as
space and time permit, with physical return flights for valid rally links.
Quick Practice uses a body recovery center, separate stroke rhythm, shot interval and movement pace, and draggable first-bounce direction/depth handles. Natural targets avoid the high-angle branch and show any bounded speed/spin adjustment. See [current practice refinement](docs/development/practice-refinement-2026-09-08.md).
The sibling MotionLab provides phase and movement review at ports 4184/4185; see
the [motion runbook](docs/development/local-motion-pipeline.md).

Moving opponents now arrive in the prepared groundstroke/slice/volley pose and
continue into the swing without resetting to ready or repeating the unit turn.
MotionLab exposes **Unit Turn Complete** and **From prepared pose** for review.
See the [prepared-entry verification](docs/development/prepared-stroke-entry-2026-09-08.md).
Venue review remains `/venue-review.html?venue=clay-sunset-arena&camera=corner`.
All six authored venues are the default under [ADR-0013](docs/decisions/0013-six-authored-venues-and-audience.md).
No public deployment is implied by these local services.
