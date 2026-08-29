# V1 implementation status

- **Status:** Active
- **Last updated:** 2026-08-29
- **Current implementation commit:** updated at each completed stage

This is the evidence ledger for the code-backed V1. “Implemented” means runnable code exists; “verified” additionally requires the named automated and browser evidence. Production opponent and generated venue assets are intentionally external dependencies and do not block the functional ball-machine implementation.

## Stage 0 — application visual system

- Three 1920 × 1080 implementation references cover practice setup, active rehearsal, and the timeline editor.
- Tokens, component families, icon policy, responsive behavior, and allowed rehearsal copy are recorded in the [application UI concepts](../concepts/application-ui-concepts-2026-08.md).
- Commit: `604bb26`.

## Stage 1 — runnable renderer and trajectory foundation

### Implemented

- React 19 + TypeScript + Vite application scaffold.
- Direct Three.js `WebGLRenderer` lifecycle isolated from React's render cycle.
- Regulation SI-unit court dimensions, lines, net mesh/tape sag, near/far context, umpire chair, bench, simple stands/trees, and a procedural ball-machine opponent substitute.
- Configurable player camera with horizontal-FOV semantics and working realistic, wide, baseline-left, baseline-right, and approach presets.
- Fixed 240 Hz gravity/drag/Magnus trajectory integration with first-bounce target correction and independent hard/clay/grass impact profiles.
- Live trajectory, animated ball, landing/net diagnostics, renderer FPS/frame-time reporting, pause/restart, surface/spin/pace controls, and responsive setup shell.

### Verification

- `npm test`: 2 files, 3 tests passed.
- `npm run build`: production build passed; the initial Three.js application chunk is approximately 200 kB gzip. Route/engine splitting remains a later performance task.
- Playwright CLI at 1920 × 1080: page loaded under WebGL 2 with zero browser-console errors or warnings.
- Interaction proof: Baseline R changed camera position/FOV, Hard → Clay changed visual and bounce profile, Pause stopped the preview and changed the primary action.
- Numerical proof: exact court constants, legal net crossing, target landing tolerance, and differing hard/grass post-bounce arrival.

### Known stage gaps

- Procedural environment and ball machine are intentionally low-detail stand-ins for the pending generated venue/opponent assets.
- Header routes, physical-display dialog, full rehearsal mode, drill library, editor, saved views, import/export, audio, service worker, and completion flow are subsequent stages.
- UI chrome is structurally faithful but some control type and court-preview framing still need the final 1920 × 1080 fidelity pass.
- WebGPU versus WebGL evidence is not yet sufficient to accept ADR-0001.

## Stage 2 — deterministic session player

### Implemented

- Versioned shot and drill contracts with 12 groundstrokes, 8 serves, 4 net/lob/overhead feeds, and all six required entry categories.
- Seeded session compiler with bounded landing/pace variation, surface selection, drill-defined or user-overridden spin, and opponent handedness metadata.
- Content-wide trajectory validation for net crossing and in-bounds first bounce; inverse launch correction now enforces target and net clearance together.
- Full-screen rehearsal surface with three-second countdown, repetition advancement, pause/resume, previous/next, restart, 0.5×–1.25× playback, exact-seed replay, new-seed variation, and completion summary.
- Separate learning mode trajectory/direction cues and uncluttered rehearsal mode.
- Synthetic Web Audio countdown/contact/bounce/completion cues with a mute control and persistent visual equivalents.
- Camera-path hooks for approach/volley/overhead content plus `prefers-reduced-motion` suppression.
- Coach overlay with launch, apex, landing, arrival, and renderer metrics.
- First-use safe-space acknowledgement, physical display/FOV calculation, keyboard controls, automatic pause on tab hiding, and browser full-screen control.

### Verification

- `npm test`: 3 files, 30 tests passed, including all bundled shots and seeded session determinism.
- `npm run build`: production build passed.
- Playwright CLI at 1920 × 1080: safety gate, learning/rehearsal states, configured spin, one-shot completion, replay, and console state verified.
- Browser console: zero errors and zero warnings.
- Direct `view_image` comparison covered the primary rehearsal reference and the final browser render.

### Known stage gaps

- Work/rest blocks and a visual cue-volume mixer are scheduled with the editor/persistence stage.
- Drills and Editor navigation select correctly but their route bodies arrive in Stage 3.
- Procedural visual stand-ins remain intentionally less detailed than the approved environment concept.

## Stage 3 — local drill authoring, persistence, and offline shell

### Implemented

- Working drill-library route combining six immutable bundled definitions with locally saved custom drills.
- Versioned custom-event schema with per-event shot primitive, pace, spin, landing target, camera motion, and preparation-cue overrides.
- Three-column editor with direct Three.js preview, drag reorder, add/duplicate/delete, 50-step undo/redo, metadata editing, five typed timeline tracks, live validation, and test-play launch.
- Size-limited JSON import/export with allowlisted schema fields, bundled-shot references, court-bound target checks, and rejection of remote URLs.
- Local persistence for custom drills and named camera views, including save/apply/rename/delete behavior.
- Generated service worker and manifest with real online/cache/update state in the UI.

### Verification

- `npm test`: 4 files, 34 tests passed, including event materialization, event-override compilation, malformed import handling, and hostile/invalid schema rejection.
- `npm run build`: production PWA build passed and generated a seven-entry precache plus service worker.
- Playwright CLI at 1920 × 1080: library navigation, editor rendering, title edit, duplicate, undo, local save, library reappearance, and named-view save all passed.
- Production preview at 1280 × 820: active service-worker controller confirmed, network set offline, hard reload succeeded, and UI reported `Offline · Cached shell ready`.
- Browser console: zero errors and zero warnings in the Stage 3 development interaction pass.
- Direct `view_image` comparison covered the timeline-editor reference and final browser render.

### Known stage gaps

- Production-grade quality adaptation, chunk splitting, install-icon raster variants, and broader responsive/browser coverage remain in the hardening stage.
- The opponent animation/GLB and generated-world asset layers remain explicitly pending external production assets; the functional ball machine remains the substitute.

## Stage 4 — training cadence, venue shells, lighting, and comfort controls

### Implemented

- Deterministic work/rest scheduler with configurable repetitions per block and rest duration; session duration, repetition start times, seeking, set numbering, pause/restart, and completion all use the compiled schedule.
- Accessible rest overlay with a remaining-seconds visual equivalent while ball/camera playback is stopped.
- Three independently selectable procedural venue shells—outdoor complex, indoor club hall, and indoor stadium—combined with hard, clay, and grass appearances for all nine functional combinations.
- Outdoor day, golden-hour, and floodlit-night modes; indoor neutral, warm, and bright-match modes; direction and intensity controls update presentation without entering physics or event compilation.
- Independent countdown, contact, bounce, and optional ambience volume controls; ambience remains off by default.
- Live camera-motion intensity from 0–100%, with zero disabling authored camera transforms and `prefers-reduced-motion` continuing to force the safe alternative.

### Verification

- `npm test`: 4 files, 38 tests passed, including exact work/rest timing and all venue-shell/surface construction combinations.
- `npm run build`: production PWA build passed.
- Playwright CLI at 1920 × 1080: outdoor/hard, club-hall/grass, and stadium/clay scenes rendered; lighting selectors updated by venue with zero console errors/warnings.
- Browser work/rest proof: a two-repetition, one-rep-block session entered `Rest · next set follows`, froze playback, counted down, resumed set 2, and completed at the compiled 26-second duration.
- Browser comfort/audio proof: camera motion changed to 0% and optional ambience to 30% through accessible range controls during a live set.

### Known stage gaps

- The three shells are intentionally procedural context stand-ins, not the pending generated or PBR production environment layer.
- Adaptive quality, ball presentation controls, route/chunk loading, failure fallback, install-icon raster variants, and broad responsive/performance validation remain in Stage 5.

## Stage 5 — product hardening and release audit

### Implemented

- Full camera calibration across eye height, longitudinal/lateral position, yaw, pitch, and 20–105° horizontal FOV; physical screen width/height plus viewing distance calculate both horizontal and vertical FOV and preserve exact court geometry.
- Eight built-in camera views covering realistic, wide, both baseline sides, approach, first volley, second volley, and overhead, plus locally persisted named views and complete preference persistence/migration.
- Independent court appearance and bounce-physics selectors, three venue shells, venue-correct lighting controls, and a sub-900px large-display practice recommendation.
- Seeded, bounded shot and timing variation; configurable interval, work/rest cadence, spin, net clearance, opponent hand, serve rhythm, and render quality.
- Expanded 26-shot/16-drill content floor: 12 groundstrokes, 8 serves across both hands/rhythms, approach, half-volley, volleys, lob, overhead, four Quick Rally drills, four Return drills, and four Tactical drills.
- Adaptive quality modes with automatic pixel-ratio reduction after sustained low frame rate, route-level lazy loading, production chunk splitting, renderer failure fallback, and raster 192/512 PWA icons.
- High-contrast ball and short-trail presentation options that do not change physics; one-action/H-key HUD hiding leaves transport available.
- Independent countdown, contact, bounce, footwork, and optional ambience audio levels, with persistent visual equivalents for timing-critical cues.
- Coach diagnostics now include launch speed, apex, true net clearance at the crossing x-coordinate, landing coordinates, pre/post-bounce speed, and receiver-plane height/time/speed.
- Completion summary records the run configuration; drill import validation rejects unknown fields, duplicate IDs, invalid geometry, unsupported enums, and remote references.

### Verification

- `npm test`: 5 files, 49 tests passed, including content-wide legal trajectories, seeded shot/timing replay, work/rest timing, surface behavior, pre/post-bounce diagnostics, storage migration, and hostile import rejection.
- `npm run build`: production PWA build passed with route chunks separated from the app shell and Three.js scene; main application code is approximately 63 kB gzip and the lazy scene chunk approximately 137 kB gzip.
- Playwright CLI at 1920 × 1080: independent clay appearance/grass physics selection, 27° calculated physical FOV, persisted quality/camera preferences, live work/rest state, footwork volume, complete coach diagnostics, and zero console errors/warnings.
- Playwright CLI at 1280 × 820 and 820 × 1000: no horizontal overflow; setup stacks at the compact breakpoint and the large-display practice recommendation is visible below 900 px.
- Production preview offline hard reload: active service worker retained the application shell and reported cached offline readiness.
- Concept and final browser images were inspected directly after the setup and rehearsal passes.

### External release gates

- Replace the procedural ball machine with the licensed, game-realistic rigged opponent and reviewed tennis/general-motion clips; verify contact, blend, handedness, serve rhythm, racket socket, and appearance variants.
- Replace or enhance the procedural venue shells with approved PBR mesh or registered splat assets while preserving the exact code-owned court/proxy authority.
- Run the 30-minute mixed-session soak, named Chrome/Edge/Firefox/Safari device matrix, real TV/projector calibration, owner/coach/player observation, accessibility review, asset/license review, and public hosting/CDN/rollback validation.
- Optional 90/120 fps stays hidden until the on-device capability benchmark passes. No camera permission or V2 body tracking exists in this build.

The detailed status of every requirement is recorded in the [V1 release matrix](v1-release-matrix.md).
