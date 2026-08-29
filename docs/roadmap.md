# Project roadmap

- **Status:** Draft
- **Last updated:** 2026-08-29

This roadmap is ordered by uncertainty and integration risk. It deliberately uses evidence gates instead of calendar promises. Relative estimates can be added once the target display, V1 content scope, and asset strategy are confirmed.

## Phase 0: Product and environment alignment

### Deliverables

- Resolve the priority items in [Open questions](open-questions.md).
- Approve V1 must/should/could scope and non-goals.
- Select reference hardware, browser, display size, viewing distance, and room setup.
- Decide whether the initial audience is self-directed players, coaches, or both.
- Approve the intended opponent art direction and asset budget path.
- Generate and approve a complete visual concept for setup, drill selection, active rehearsal, pause, and completion states.

### Exit gate

The owner can describe the first useful session, target hardware, included V1 shot families, and accepted visual direction without unresolved P0 ambiguity.

## Phase 1: Risk-reduction vertical slice

Build one standards-dimension court, one camera calibration screen, one animated forehand opponent clip, and one ball that crosses the net, bounces, and reaches the receiver plane.

### Workstreams

1. Scaffold React/TypeScript/Vite with engine/UI boundaries.
2. Implement regulation court coordinates and camera calibration.
3. Implement a high-resolution reference trajectory solver and a candidate real-time fixed-step solver.
4. Add a debug trajectory path and numerical event report.
5. Synchronize one opponent contact marker to launch.
6. Run the WebGPU/WebGL 2 renderer comparison.
7. Test at 1080p and target 4K/display setup.

### Exit gate

- Ball landing, net clearance, bounce, and arrival values pass numerical tolerances.
- Contact looks connected in frame-step and normal-speed review.
- Renderer choice has measured startup/performance/visual evidence.
- Physical-view and immersive FOV modes have been tested on a real target screen.
- ADR-0001 is accepted or replaced.

## Phase 2: Groundstroke lab

### Deliverables

- Forehand/backhand/body target zones.
- Flat/topspin/slice families with explicit pace, depth, height, and spin controls.
- Hard-court surface physics baseline and separate visual themes.
- Single-shot repeat player with countdown, interval, pause, replay, and seeded variation.
- Learning-mode trajectory/target cues and rehearsal-mode clean view.
- Coach/debug metrics and a shot-authoring validation tool.
- Initial opponent idle, split-step, groundstroke, and recovery clips.

### Exit gate

At least 12 single-shot presets pass deterministic numerical tests, contact review, and coach/user perception checks. A 30-minute soak is stable on reference hardware.

## Phase 3: Serve and return visualization

### Deliverables

- Serve toss/contact/recovery animations.
- Flat, slice, and kick serve flight/bounce profiles.
- Deuce/ad court and T/body/wide service-box zones.
- Returner camera presets and service recognition drill.
- Serve-specific bounce and receiver-plane validation.

### Exit gate

At least four serve presets land legally, remain synchronized to opponent contact, and are distinguishable by target users above an agreed threshold.

## Phase 4: Tactical sequence engine

### Deliverables

- Declarative timeline compiler for opponent, ball, camera, rest, and cue events.
- Baseline sequence presets, exact replay, and bounded seeded variation.
- Center/corner/short-forward camera paths with reduced-motion alternatives.
- Local custom drill composition if it remains in V1.
- Content/asset schema validation and migration tests.

### Exit gate

Two multi-shot patterns run without timeline drift through repeated pause/resume/restart cycles and remain deterministic across render refresh rates.

## Phase 5: V1 production hardening

### Deliverables

- Approved opponent/court/ball production assets with provenance.
- Adaptive 1080p–4K quality levels and loading/caching strategy.
- Keyboard/full-screen/accessibility/safety pass.
- Browser matrix, long soak, asset failure, and fallback testing.
- Complete concept-to-browser visual fidelity review.
- User/coach testing, issue triage, release notes, and deployment runbook.

### Exit gate

Every V1 release criterion in the PRD has evidence. Any deferred item is explicit and does not masquerade as implemented or deployed.

## Phase 6: V1.1 candidate work

- Approach, volley, second volley, overhead, and serve-and-volley sequences.
- Timeline editor improvements and drill JSON import/export.
- Additional surface physics and venue/opponent variants.
- Optional higher-refresh-rate mode.

Each candidate returns to a product-scope gate; none is automatically included because the engine can technically support it.

## V2 research track: body tracking

This begins only after V1 is useful without a camera.

1. Local webcam permission and privacy UX.
2. Worker-isolated pose inference benchmark alongside 3D rendering.
3. Calibration from camera landmarks to court/player coordinates.
4. Confidence, occlusion, latency, and lost-tracking behavior.
5. A narrow interaction experiment such as stance/side recognition before swing grading.
6. Safety and product-claim review before camera-driven camera motion or technique feedback.

## Cross-cutting evidence expected per milestone

- Requirement IDs covered.
- Current Git commit and asset hashes.
- Numerical test report for every new shot/surface.
- Browser/device/backend matrix used.
- Performance measurements and screenshots/video where relevant.
- Manual coach/owner review gates still outstanding.
- Documentation and ADR updates committed with the work.
