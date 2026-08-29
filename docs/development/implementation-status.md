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
