# Documentation process

This folder is the project record for product discovery, design, architecture, and delivery. Documentation changes should land with the implementation or decision that makes them necessary.

## Structure

- `product-requirements.md`: the product contract for the current intended release.
- `technical-architecture.md`: the current system design and boundaries.
- `concepts/`: generated or drawn visual hypotheses with prompts, limitations, and explicit owner-review status.
- `research/`: dated research and option comparisons. Claims that can drift should link to primary sources and record the research date.
- `decisions/`: architecture decision records (ADRs). ADRs are append-only once accepted; later changes should supersede them with a new ADR.
- `roadmap.md`: milestone order and validation gates, not a promise of calendar dates.
- `open-questions.md`: unresolved owner choices and research spikes.
- `development/`: implementation status, verification evidence, and operational development notes.

## Status language

- **Draft**: being explored; content may change without a superseding decision.
- **Proposed**: a specific recommendation awaiting owner approval or prototype evidence.
- **Accepted**: the active decision that implementation must follow.
- **Superseded**: retained for history but replaced by a later document.

## Design and delivery loop

1. Maintain the accepted V1/V2 boundary and define reproducible device/display performance tiers.
2. Keep the V1 requirements and measurable acceptance criteria current.
3. Generate a complete primary-screen visual concept and critical states, then obtain owner approval.
4. Run a thin renderer, trajectory, animation-sync, display-calibration, and asset-pipeline spike.
5. Accept or revise the relevant ADRs based on measured evidence.
6. Implement one vertical slice at a time, updating requirements and technical notes with each slice.
7. Verify ball behavior numerically and the visible experience in supported browsers and target display sizes.

## Current visual-development records

- [Court environment boards](concepts/court-environment-concepts-2026-08.md): the six accepted venue directions and initial Panel 1 baseline.
- [Scene-generation prompt kit](concepts/scene-generation-prompt-kit.md): three reusable camera prefixes and six independent environment prompts.
- [Opponent character 01](concepts/opponent-character-01.md): first fictional right-handed male design sheet and detachable-racket guidance.
- [Application UI concepts](concepts/application-ui-concepts-2026-08.md): implementation references for setup, rehearsal, and timeline editing.
- [Mocap-to-web pipeline](research/mocap-to-web-character-pipeline.md): custom tennis clips, open/general motion integration, licensing, retargeting, and runtime blending.
- [Neutral opponent asset record](assets/quaternius-neutral-opponent.md): selected CC0 mesh, normalization recipe, hashes, rig/socket map, and animation acceptance gates.
- [Ball and opponent visibility calibration](research/ball-and-opponent-visibility.md): official color boundary, optic renderer values, outlined-opponent contract, and remaining display gates.
- [Implementation status](development/implementation-status.md): staged code coverage, verification, and remaining gaps.
- [Visual verification ledger](development/visual-verification.md): concept-to-browser comparison after each implementation stage.
- [V1 release matrix](development/v1-release-matrix.md): requirement-by-requirement code evidence and the remaining asset, device, human, and deployment gates.

## Decision index

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](decisions/0001-web-rendering-and-simulation-architecture.md) | Accepted for V1 runtime | React/Vite shell, direct Three.js WebGL 2 runtime, and tennis-specific ball solver |
| [0002](decisions/0002-v1-scope-and-release-model.md) | Accepted | Complete public-free non-tracking V1; camera-based player tracking defines V2 |
| [0003](decisions/0003-hybrid-asset-authoring-strategy.md) | Superseded | Historical generated-character and hybrid asset proposal |
| [0004](decisions/0004-generated-world-environment-layer.md) | Superseded | Historical generated mesh/splat venue-shell proposal |
| [0005](decisions/0005-canonical-threejs-scenes-and-neutral-opponent.md) | Accepted | Six canonical Three.js scenes and a neutral mocap-first humanoid opponent |
| [0006](decisions/0006-nine-venue-atmosphere-weather-and-wind.md) | Superseded in venue catalogue scope | Nine-venue catalogue; atmosphere/weather, procedural materials, aligned fixtures, and physical wind remain accepted |
| [0007](decisions/0007-six-venue-catalogue-and-camera-relative-navigation.md) | Accepted | Six uniformly named venues and yaw-relative camera navigation with explicit height controls |
| [0008](decisions/0008-itf-runoff-opponent-positioning.md) | Accepted | ITF competition-runoff opponent placement and a behind-baseline Rally default |

## Change discipline

- Product changes update the PRD and, when architectural, add or supersede an ADR.
- Every shot preset must be data-defined, deterministic, and covered by trajectory acceptance tests.
- Asset licenses, source files, export settings, and animation-contact metadata must be recorded before an asset can ship.
- Deployment, camera capture, accounts, telemetry, and body tracking require explicit decisions; they are not implicit consequences of building the V1 front end.
