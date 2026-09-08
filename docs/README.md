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

## Current research reading packets

- [Persistent court capture implementation and verification](development/persistent-court-capture-2026-09-09.md): stable canvas/audio capture across setup and practice, local preview and explicit iOS receiver-transport limitation. Native Screen Mirroring is a manual fallback.

- [Website-initiated casting to existing receivers](research/lan-casting-and-mirroring-2026-09-08.md): website-only sender requirement, existing Lebo/Qiyiguo targets, browser media/capture limits and current SDK catalogue evidence. Native senders and custom receiver pages are excluded; no qualifying live casting implementation is verified.
- [TennisVAR and TANS crash course](research/tennisvar-tans-crash-course-2026-09-08.md): original papers, guided methodology, results, limitations, notation examples, and a reading plan.
- [TennisVAR/TANS integration assessment](research/tennisvar-tans-integration-2026-09-08.md): current code fit, public release audit, source receipts, and a proposed chart-to-rehearsal pilot. Research only; no implementation or accepted ADR change.

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
- [Local motion pipeline](development/local-motion-pipeline.md): local video analysis, corrected tennis clips, connectors, and runtime integration under ADR-0012.
- [Mocap-to-web research](research/mocap-to-web-character-pipeline.md): historical cloud comparisons and reusable retargeting principles; cloud processing is superseded.
- [Articulated player record](assets/quaternius-articulated-mannequin.md): active CC0 model, binder and rig contract. The [original carrier](assets/quaternius-neutral-opponent.md) is retained skeleton/provenance history.
- [Ball and opponent visibility calibration](research/ball-and-opponent-visibility.md): official color boundary, optic renderer values, outlined-opponent contract, and remaining display gates.
- [Implementation status](development/implementation-status.md): staged code coverage, verification, and remaining gaps.
- [Visual verification ledger](development/visual-verification.md): concept-to-browser comparison after each implementation stage.
- [Blender venue pipeline](development/blender-venues.md) and [clay arena](development/clay-arena.md): DCC setup, primary references, source/asset provenance and local review.
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
| [0009](decisions/0009-blender-hard-open-arena-pilot.md) | Accepted for opt-in review | Blender-authored hard arena with validated loading and procedural fallback |
| [0010](decisions/0010-blender-clay-arena-and-multi-venue-boundary.md) | Accepted for opt-in review | Reference-led clay arena and independent two-venue asset boundary |
| [0011](decisions/0011-blender-grass-arena.md) | Accepted | Authored grass arena pilot |
| [0012](decisions/0012-local-opponent-motion-pipeline.md) | Accepted; carrier selection updated by 0014 | Local reference-led motion production in the independent lab |
| [0013](decisions/0013-six-authored-venues-and-audience.md) | Accepted | Six authored venues, performance variants and audiences |
| [0014](decisions/0014-articulated-player-and-complete-motion-library.md) | Accepted | Articulated player, complete motion bundle and two distinct service rhythms |

The [motion integration receipt](development/motion-main-integration-2026-09-07.md) records the current branch/main and live-gameplay verification. Revision counts in historical ledgers are scoped to their original commits.

Current practice/landing behavior: [ADR-0018](decisions/0018-uniform-landing-zones-and-continuous-preview.md), with [scene and distribution verification](development/landing-zone-verification-2026-09-08.md). This supersedes fixed target points and CSS landing handles while retaining the independent clocks from ADR-0017.

## Change discipline

Current short-running correction after owner feedback:
[ADR-0033](decisions/0033-complete-short-running-steps.md) and
[actual footwork verification](development/short-running-steps-2026-09-08.md).

Current gait and pace ownership: [ADR-0032](decisions/0032-speed-and-cadence-locomotion.md)
and [movement verification receipt](development/movement-selection-2026-09-08.md).

Current renderer cost and preview preparation: [ADR-0031](decisions/0031-measured-renderer-cost-and-preview-preparation.md)
and [GPU/CPU profiling receipt](development/renderer-performance-2026-09-08.md).

Current drill camera and reusable-shot authoring: [ADR-0022](decisions/0022-continuous-drill-camera-and-reusable-shots.md)
and [camera/editor verification](development/drill-camera-and-editor-2026-09-08.md).

Current move-to-hit sequencing: [ADR-0021](decisions/0021-prepared-stroke-entry-after-travel.md)
and [prepared-entry verification](development/prepared-stroke-entry-2026-09-08.md).

[ADR-0012](decisions/0012-local-opponent-motion-pipeline.md) accepts local opponent motion production in the sibling motion-analysis laboratory, replacing online mocap services.

- Product changes update the PRD and, when architectural, add or supersede an ADR.
- Every shot preset must be data-defined, deterministic, and covered by trajectory acceptance tests.
- Asset licenses, source files, export settings, and animation-contact metadata must be recorded before an asset can ship.
- Deployment, camera capture, accounts, telemetry, and body tracking require explicit decisions; they are not implicit consequences of building the V1 front end.
