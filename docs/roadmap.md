# Project roadmap

- **Status:** Draft
- **Last updated:** 2026-08-30

**Current checkpoint:** the code-owned local ball-machine product now spans the functional work in Phases 1–6. The phase exit gates remain open where they require production 3D assets, measured target hardware/browser evidence, the 30-minute soak, human observation, licensing, or public deployment. See the [V1 release matrix](development/v1-release-matrix.md).

**Visual-pipeline checkpoint (2026-08-31):** ADR-0005/0006/0007 make six court environments canonical Three.js compositions and remove Gaussian splats, generated-world assets, and downloaded venue textures from the runtime. Three outdoor arenas, three seating-free indoor courts, shared dynamic sky/weather, physical wind, and the CC0 neutral humanoid carrier are integrated. Venue work now moves through owner/target-device polish; opponent work waits on the owner-supplied mocap clips, separate racket, and retarget/contact review.

This roadmap is ordered by uncertainty and integration risk. V1 is one complete public-free, non-tracking product; features are not split into must/should/could or a V1.1. Calendar estimates follow the vertical slice and asset bake-off.

## Phase 0: Product, visual, and asset alignment

**2026-09-05 motion update:** Finished mocap is no longer an owner-supplied dependency. The [local motion pipeline](development/local-motion-pipeline.md) owns source selection, local extraction/authoring, racket, connectors, retargeting, and gameplay integration in the sibling analysis lab. No online mocap service is required. This supersedes the waiting-on-mocap checkpoint above.

### Deliverables

- Record the accepted V1/V2 boundary and public-free release model.
- Implement from the complete game-realistic setup, rehearsal, and timeline-editor concept set; keep pause, diagnostics, and completion states in the same recorded system.
- Use accepted outdoor Panel 1 as the first visual/technical north star; select the second indoor north star before composing that venue.
- Keep the matched high-oblique, player-level, and true top-down Panel 1 images as composition references only.
- Preserve the first fictional right-handed male opponent sheet as historical concept work; do not convert it into the runtime character.
- Run a neutral-humanoid rig, animation-retargeting, and web-optimization bake-off.
- Preserve the completed world/character research as history; do not spend further budget on generated meshes or world shells.
- Select a neutral rights-cleared humanoid source, motion source, Blender retarget/cleanup workflow, commercial provenance record, and general-motion source for ready/footwork/recovery connectors.
- Build and visually calibrate all six venues through the canonical shared Three.js atmosphere, shader-material, and composition system.
- Define reference performance tiers rather than one mandatory room/display/GPU.
- Confirm the first tennis biomechanics reviewer and initial hosting/CDN experiment.

### Exit gate

The owner has accepted the visual direction, one provisional neutral-humanoid/motion pipeline, the canonical scene-composition system, the reference performance matrix, and the first useful-session walkthrough. Total external asset and mocap experimentation remains below US$100. Unpriced, unlicensed, or unexportable opponent assets cannot pass this gate.

## Phase 1: Risk-reduction vertical slice

Build one standards-dimension court, one complete canonical Three.js Panel 1 venue, camera calibration/preferences, one neutral mocap-driven humanoid opponent, and one ball that crosses the net, bounces, and reaches the receiver plane.

### Workstreams

1. Scaffold React/TypeScript/Vite with engine/UI boundaries.
2. Implement regulation court coordinates and adjustable camera calibration.
3. Implement a high-resolution reference trajectory solver and real-time fixed-step candidate.
4. Add debug trajectory/event evidence.
5. Synchronize one opponent contact marker to launch.
6. Compare WebGPU, forced WebGL 2, and mature WebGLRenderer paths.
7. Compare an optimized GLB opponent against one code-generated court on 1080p and 4K displays.
8. Compare Panel 1 composition/material/lighting iterations directly against the accepted player-level and overview concepts.
9. Measure initial bytes, parse/decode, first frame, warm cache, offline behavior, depth/occlusion, and lighting changes.

### Exit gate

- Ball landing, net clearance, bounce, and arrival pass numerical tolerances.
- Contact passes frame-step and normal-speed review.
- Renderer selection has measured compatibility/performance/visual evidence.
- Realistic default and user-adjusted physical/immersive views pass a real-screen review.
- ADR-0001 and ADR-0003 are accepted, replaced, or narrowed using the evidence.
- ADR-0004 remains superseded; ADR-0005's Panel 1 visual and runtime acceptance evidence is recorded.

## Phase 2: Baseline laboratory and core player

### Deliverables

- Near-left/body/near-right targets; cross-court/down-line/inside-out/inside-in metadata.
- Flat/topspin/slice families with explicit pace, frequency, depth, height, spin, and variation controls.
- Hard-court physics baseline plus hard, clay, and grass visual themes independently selectable inside the first complete venue shell.
- Single-shot/work-rest player with countdown, pause, replay, slow motion, exact seed replay, and learning/rehearsal modes.
- Opponent idle, split-step, both-hand groundstrokes, footwork, and recovery clips.
- Coach/debug metrics and authoring validation.

### Exit gate

At least 12 groundstroke presets pass deterministic tests, contact review, camera-comfort review, and owner/coach perception checks. A 30-minute baseline soak is stable.

## Phase 3: Serve and return system

### Deliverables

- Left- and right-handed server variants.
- Normal high-toss/deeper-trophy and compact low-toss/immediate-upward serve rhythms.
- Ball pace independent of motion rhythm.
- Flat, slice, and kick profiles; deuce/ad and T/body/wide zones.
- Return camera presets, recognition drills, and serve-specific validation.

### Exit gate

At least eight serve presets cover both hands and rhythms, land legally, stay contact-synchronized, and are perceptually distinguishable in player testing.

## Phase 4: Tactical movement and net play

### Deliverables

- Declarative timeline compiler for opponent, ball, camera, cues, and rest.
- Baseline tactical combinations and bounded seeded variation.
- Lateral recovery, advance/retreat, approach, first/second volley, lob, overhead, and recovery camera paths.
- Approach, volley, half-volley where required, lob, and overhead animation/ball families.
- Serve-and-volley and requested multi-ball strategic patterns.
- Reduced-motion alternative for every moving-camera sequence.

### Exit gate

Four multi-shot patterns, including serve-and-volley and overhead movement, remain deterministic through pause/resume/restart and pass motion-comfort, animation-contact, and timing review.

## Phase 5: Local authoring, variants, and offline delivery

### Deliverables

- Timeline editor with opponent, ball, camera, cue, and rest tracks.
- Pre-play content/asset/schema validation.
- Versioned drill JSON export/import and migrations.
- Multiple opponent appearances and venue/ambience variants.
- Outdoor, indoor club-hall, and indoor-stadium shells, each compatible with hard, clay, and grass; outdoor sun/day/night and indoor fixture/daylight controls.
- Service worker/offline UX and user-selected asset caching.
- Lazy asset manifests, compressed GLB/textures, immutable caching, loading and error recovery.
- Runtime capability check for optional 90/120 fps mode.

### Exit gate

One custom drill in every major family survives save, reload, export, import, replay, and offline use. Cold/warm loading and storage consumption are documented on the matrix.

## Phase 6: Public V1 production hardening

### Deliverables

- Approved production assets with source, license, cleanup, export, and hash provenance.
- Adaptive 1080p–4K quality levels and measured browser/device tiers.
- Full-screen, keyboard, accessibility, safety, and reduced-motion pass.
- Browser matrix, long soak, context loss, asset failure, and fallback testing.
- User/coach testing across multiple levels and actual TVs/projectors.
- Public hosting/CDN validation, privacy/legal pages, release notes, and deployment/rollback runbook.

### Exit gate

Every V1 release criterion in the PRD has current evidence. The deployed public build and asset origins are verified; local completion is not described as deployment.

## V2: camera-based player tracking and synchronization

V2 begins only after V1 is useful without a camera.

1. Permission, capture-state, privacy, and retention UX.
2. Worker-isolated pose/movement inference benchmark alongside rendering.
3. Calibration from camera observations to player/court coordinates.
4. Confidence, occlusion, latency, and lost-tracking behavior.
5. Camera/timeline synchronization with detected movement.
6. Narrow timing/coordination feedback experiments before any technique claims.
7. Safety, privacy, and product-claim review before release.

## Separate commercialization track

The first release is public and free. A future freemium track may add accounts, payments, entitlements, premium content, or cloud sync while preserving the V1 rendering, simulation, asset, and drill schemas. It is not allowed to hold the core V1 training features hostage or become an implicit V2 dependency.

## Cross-cutting evidence per milestone

- Requirement IDs and ADRs covered.
- Git commit and asset hashes.
- Numerical test report for every new shot/surface.
- Browser/device/backend/display matrix.
- Frame-time, memory, loading, and asset-byte measurements.
- Player-camera corridor, geometry/material counts, lighting behavior, disposal, and concept-to-render evidence for every canonical scene.
- Screenshots/video and animation-contact evidence where relevant.
- Asset/model/input/output licenses and source provenance.
- Manual owner/coach gates still outstanding.
- Documentation committed with the work.
