# Project roadmap

- **Status:** Draft
- **Last updated:** 2026-08-29

This roadmap is ordered by uncertainty and integration risk. V1 is one complete public-free, non-tracking product; features are not split into must/should/could or a V1.1. Calendar estimates follow the vertical slice and asset bake-off.

## Phase 0: Product, visual, and asset alignment

### Deliverables

- Record the accepted V1/V2 boundary and public-free release model.
- Approve a complete game-realistic visual concept for setup, drill selection/editor, rehearsal, pause, diagnostics, and completion.
- Run the standardized opponent/animation bake-off in the AI 3D research note.
- Select a provisional character source, motion source, Blender cleanup workflow, and commercial provenance record.
- Define reference performance tiers rather than one mandatory room/display/GPU.
- Confirm the first tennis biomechanics reviewer and initial hosting/CDN experiment.

### Exit gate

The owner has accepted the visual direction, one provisional asset pipeline, the reference performance matrix, and the first useful-session walkthrough. Unpriced or unlicensed production assets cannot pass this gate.

## Phase 1: Risk-reduction vertical slice

Build one standards-dimension procedural court, camera calibration/preferences, one game-realistic animated opponent, and one ball that crosses the net, bounces, and reaches the receiver plane.

### Workstreams

1. Scaffold React/TypeScript/Vite with engine/UI boundaries.
2. Implement regulation court coordinates and adjustable camera calibration.
3. Implement a high-resolution reference trajectory solver and real-time fixed-step candidate.
4. Add debug trajectory/event evidence.
5. Synchronize one opponent contact marker to launch.
6. Compare WebGPU, forced WebGL 2, and mature WebGLRenderer paths.
7. Compare an optimized GLB opponent against one code-generated court on 1080p and 4K displays.
8. Measure initial bytes, parse/decode, first frame, warm cache, and offline behavior.

### Exit gate

- Ball landing, net clearance, bounce, and arrival pass numerical tolerances.
- Contact passes frame-step and normal-speed review.
- Renderer selection has measured compatibility/performance/visual evidence.
- Realistic default and user-adjusted physical/immersive views pass a real-screen review.
- ADR-0001 and ADR-0003 are accepted, replaced, or narrowed using the evidence.

## Phase 2: Baseline laboratory and core player

### Deliverables

- Near-left/body/near-right targets; cross-court/down-line/inside-out/inside-in metadata.
- Flat/topspin/slice families with explicit pace, frequency, depth, height, spin, and variation controls.
- Hard-court physics baseline plus three independently selectable visual themes.
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
- Screenshots/video and animation-contact evidence where relevant.
- Asset/model/input/output licenses and source provenance.
- Manual owner/coach gates still outstanding.
- Documentation committed with the work.
