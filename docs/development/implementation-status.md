# V1 implementation status

- **Status:** Active
- **Last updated:** 2026-08-30
- **Current implementation commit:** updated at each completed stage

This is the evidence ledger for the code-backed V1. “Implemented” means runnable code exists; “verified” additionally requires the named automated and browser evidence. The neutral humanoid carrier is now integrated; its tennis mocap and racket remain owner-supplied production inputs. Venue fidelity is repository-owned implementation work under ADR-0005 rather than a generated-asset dependency.

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

- Procedural environment and ball machine were intentionally low-detail Stage 1 stand-ins; Stage 6 replaces the venue blockouts through canonical Three.js composition and makes the ball machine a neutral-opponent load fallback.
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
- At this stage the opponent animation/GLB remained an external production asset and the ball machine was the substitute. Stage 6 later integrated the neutral GLB carrier while leaving tennis motion and the racket pending. Generated-world assets have been removed from the direction.

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

- The three shells are intentionally procedural context stand-ins. ADR-0005 makes their six-scene replacement code-owned rather than an imported environment layer.
- Adaptive quality, ball presentation controls, route/chunk loading, failure fallback, install-icon raster variants, and broad responsive/performance validation remain in Stage 5.

## Stage 5 — product hardening and release audit

### Implemented

- Full camera calibration across eye height, longitudinal/lateral position, yaw, pitch, and 20–105° horizontal FOV; physical screen width/height plus viewing distance calculate both horizontal and vertical FOV and preserve exact court geometry.
- Eight built-in camera views covering realistic, wide, both baseline sides, approach, first volley, second volley, and overhead, plus locally persisted named views and complete preference persistence/migration.
- Stage 5 originally shipped independent court appearance and bounce-physics selectors; Stage 8 supersedes them with one coherent surface control. Three venue shells, venue-correct lighting controls, and a sub-900px large-display practice recommendation remain.
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
- Historical Playwright CLI at 1920 × 1080 verified the former independent clay-appearance/grass-physics path, 27° calculated physical FOV, persisted quality/camera preferences, live work/rest state, footwork volume, complete coach diagnostics, and zero console errors/warnings. Stage 8 supersedes the independent-surface behavior.
- Playwright CLI at 1280 × 820 and 820 × 1000: no horizontal overflow; setup stacks at the compact breakpoint and the large-display practice recommendation is visible below 900 px.
- Production preview offline hard reload: active service worker retained the application shell and reported cached offline readiness.
- Concept and final browser images were inspected directly after the setup and rehearsal passes.

### External release gates

- Complete the integrated licensed neutral carrier with reviewed tennis/general-motion clips and a separate racket; verify contact, blend, handedness, serve rhythm, socket transforms, and deformation.
- Continue owner-led visual polish of the nine canonical Three.js venues while preserving exact court authority, atmosphere coherence, and procedural-material rules.
- Run the 30-minute mixed-session soak, named Chrome/Edge/Firefox/Safari device matrix, real TV/projector calibration, owner/coach/player observation, accessibility review, asset/license review, and public hosting/CDN/rollback validation.
- Optional 90/120 fps stays hidden until the on-device capability benchmark passes. No camera permission or V2 body tracking exists in this build.

The detailed status of every requirement is recorded in the [V1 release matrix](v1-release-matrix.md).

## Stage 6 — canonical Three.js scene pivot

- **Status:** Active from 2026-08-30
- ADR-0005 replaces generated-world/splat environments with six canonical TypeScript/Three.js compositions.
- The accepted Panel 1 player-level concept is the first fidelity target; current procedural shells are blockouts to be replaced component by component.
- The opponent target is now one neutral rights-cleared faceless humanoid optimized for mocap retargeting, not a generated character or appearance library.
- Visual acceptance requires repeated concept-versus-browser inspection at the player camera and an overview camera, plus material, lighting, performance, and disposal evidence.

### Composition-system slice 1 — complete

- Replaced the three hard-coded shell identifiers with six typed scene definitions covering outdoor club, clay terrace, grass park night, timber hall, clay stadium, and covered grass arena.
- Added saved-preference migration from the legacy `outdoor`, `club-hall`, and `stadium` identifiers.
- Split rendering construction into deterministic procedural materials, shared primitives, reusable court/venue props, and scene compositions.
- Added local color/scale texture maps for acrylic, clay, grass, runoff, concrete, timber, and roofing without introducing runtime asset downloads.
- Added shared fence, bleacher, shelter, umpire-chair, light-pole, vegetation, and architecture builders plus unique-material/geometry/texture disposal.
- Built the first Panel 1 composition pass and functional identity scaffolds for the remaining five scenes. All six were switched and captured at 1920 × 1080 with zero browser console errors.
- `npm run build` passes; the complete unit/content/storage suite passes at 53 tests.
- Playwright's headed Chromium was OS-background-throttled to roughly 1 request-animation-frame per second, so that metric is explicitly invalid as scene-performance evidence. Foreground target-device profiling remains required.

### Panel 1 fidelity slice 1 — complete

- Iterated four browser renders against the accepted player-level reference, plus a separate wide-player render for enclosure and side-context inspection.
- Raised the clubhouse on a modeled terrace with central stairs, veranda glazing/columns, planters, shrubs, railings, and a correctly camera-facing standing-seam roof.
- Tuned court/runoff albedo, repeating scale, micro-normal response, net darkness, fence opacity, seating scale, shelter color, and umpire-chair readability from direct image comparison.
- Replaced spherical cloud props with a procedural gradient/fBM sky shader and added instanced foliage/hedge edge detail to break the original primitive silhouettes.
- The exact court, camera, ball, lighting controls, and surface/physics independence remain unchanged. Full build and all 53 tests pass; final 1920 × 1080 player/wide renders report zero browser console errors.

### Remaining-scene fidelity slice 1 — complete

- Expanded the Mediterranean clay scene with a full clay runoff, six-level stone terraces, retaining walls, cypress/hedge layers, a central stair, and an arched terracotta-roof villa.
- Expanded the night grass scene with a full grass deck, three-sided individual green seating, dense planting, perimeter fencing, modeled light poles, and a calibrated floodlit play area.
- Expanded the timber hall with repeated laminated portal frames, pitched pale roof panels, glazing bays, warm artificial light, lower timber wall bands, and individual blue stands.
- Expanded the indoor clay stadium with three-sided individual warm seating, portals, media glazing, concourse rails, roof truss depth, and controlled bright-match lighting.
- Expanded the covered grass arena with three-sided individual green seating, pale roof structure, framed end glazing, and a visible landscape/tree layer beyond the arena.
- Corrected surface appearance so hard uses blue acrylic plus green runoff, clay uses clay across the full playable deck, and grass uses the striped grass map across the full deck; bounce physics remains an independent selection.
- Browser iterations caught and corrected both under-lit first renders and an overexposed physical-light pass. Final player renders for all six scenes complete with zero console errors; full build and all 53 tests remain green.

### Neutral opponent carrier slice 1 — complete

- Selected the free CC0 Quaternius Universal Base Characters male as a replaceable athletic motion carrier after inspecting the actual archive, glTF scene graph, 65-joint skin, bone names, material/texture dependencies, and license file.
- Added a reproducible neutralization script that fails closed on missing canonical bones, removes all texture references, excludes eye/eyebrow scene nodes, assigns one matte material, and writes a self-contained 741,412-byte GLB.
- Added a 23-role canonical skeleton adapter, both named hand/racket sockets, lazy GLB loading, separately loadable animation bundles, `AnimationMixer` clip playback/cross-fade hooks, scaling to 1.84 m, shadows, disposal, and a procedural neutral ready stance.
- The temporary ball machine is now a load/skeleton-failure fallback rather than the primary opponent. The app remains functional if the external GLB cannot load.
- Recorded the source/archive/runtime hashes, CC0 notice, limitations, and exact remaining mocap/racket/contact gates in the asset record and shipped manifest.
- `npm run build` passes; the suite passes at 56 tests, including the exact GLB hash/header/scene-graph contract. The GLTF loader is emitted as a separate approximately 13.2 kB gzip chunk, and the GLB/license/manifest are present in the 29-entry, approximately 1.8 MiB production precache. Fresh-browser inspection at baseline, approach, and first-volley views confirmed scale, orientation, ready silhouette, fallback behavior, and no new console errors. Background-window FPS remains invalid performance evidence.

## Stage 7 — nine venues, dynamic atmosphere, weather, and wind

- **Status:** Implemented locally on 2026-08-30; owner and target-device visual approval remain open
- ADR-0006 expands the catalogue to exactly six outdoor venues and three simple indoor halls.
- Added owner-reference-calibrated outdoor arena identities for a blue hard open-roof arena, sunset clay bowl, and open-roof grass center court. They now use three distinct continuous superellipse plans: a three-tier rounded oval, an asymmetric rounded rectangle with partial upper arcs, and a two-tier rounded-square continuous bowl. Instanced seat counts are constrained to 13,000–16,500 per venue rather than represented by metadata alone.
- Reworked the three original outdoor scenes with larger ground/context extents, access paths, hedges/planting layers, pavilions/club buildings, retaining structure, perimeter architecture, and venue-local floodlight poles.
- Removed audience seating from all three indoor scenes. Replaced the covered-grass roof with an upright 18-panel semicircular barrel vault and repeated structural ribs.
- Replaced detached global point lights with fixture-local spotlights. Every indoor fixture and outdoor lamp array now owns an actual light source at its visible lens transform; all six outdoor venues have pole or roof-line systems whose intensity is derived from solar elevation, remaining off in daylight and fading on through twilight/night.
- Replaced all CPU `DataTexture` venue maps with deterministic GLSL layered onto physical materials. Court, runoff, line, ground, seats, concrete, timber, metal, roof, wall, planting, glass, and ad-board materials expose procedural pattern, time, wind, and wetness uniforms; the venue texture bundle is empty.
- Added one renderer-owned Three.js `Sky`, continuous solar elevation/azimuth, directional sun, hemispheric diffusion, weather-driven fog/scattering, throttled PMREM environment generation, and clear/overcast/rain states.
- Consolidated cloud rendering into the current Three.js `Sky` shader's animated multi-octave cloud uniforms. Clear, overcast, and rain states share the same scattering/cloud model as the visible sky and PMREM input; clear-sky Mie scattering and disc energy are bounded so noon and golden hour no longer produce an oversized white solar bloom.
- Added an 850-drop procedural shader rain field. Precipitation direction responds to the same configured world-space wind as foliage shader sway.
- Replaced the copied rectangular arena sections with continuous stepped superellipse geometry, rounded guardrails, instanced seat pans/backs, radial aisle gaps, venue-specific concourses/fascias, unbranded ad marks, and three separately authored roof systems. Double-sided roof/fascia/net material clones retain their procedural shader hooks rather than falling back to plain white materials.
- Replaced the overlapping runoff slab with a coplanar ring around the 4 cm playing slab, reduced line relief to 1.5 mm from the shared y=0 plane, and rebuilt the regulation net at 64 × 24 divisions with a 7.5 cm double-sided top tape and center strap.
- Enriched the seating-free indoor shells with wall ribs, acoustic panels, doors, service runs, and far-wall glazing. The grass hall now closes its arched end with a procedural semicircular panel field and suspends each aligned fixture from the calculated vault height.
- Added locally persisted time, weather, weather intensity, wind direction, and wind speed controls. Wind converts to court-frame air velocity and affects drag/Magnus in the deterministic `ball-v2-wind` solver; weather remains visual-only.
- Calm and wind trajectory tests, legacy storage normalization, nine-venue registry, no-seating indoor contract, venue-specific rounded tiers and capacity bounds, all-six outdoor floodlights, coplanar court layers, dense net/tape, procedural-surface switching, fixture/lens alignment, and upright roof coverage bring the full suite to 64 passing tests.
- `npm run build` passes. The renderer chunk is approximately 171.5 kB gzip and the 29-entry generated PWA precache remains approximately 1.81 MiB with no external venue texture/model payload added.
- In-app browser verification exercised the outdoor club at noon, all three arena identities, the hard arena at night, and the close approach view. The loop caught and fixed the residual solar wash plus procedural-shader loss on cloned double-sided materials. Final switching produced zero browser console errors or warnings. The references and final captures were inspected together; detailed roof mechanics, architectural weathering, foreground reference-device profiling, and owner visual approval remain explicit gates.

## Stage 8 — practice interaction and physical shot setup

- **Status:** Implemented locally on 2026-08-30; owner interaction review remains open
- Reduced the Practice rail to Rally, Return, Volley, and Overhead setup presets. Each preset selects an incoming-ball origin, source height, drill cadence, and starting camera position.
- Replaced the learning/rehearsal selector with one trajectory on/off switch and removed the second hidden cue behavior so the label matches the actual contract.
- Split the right configuration surface into collapsible Ball & rhythm, Practice set, Opponent, Venue, Perspective, and System sections. Venue follows the ball/practice/opponent controls, and net clearance now sits beside pace and interval.
- Removed the setup-only offline badge and repeated safety footer, reduced the preset toolbar from 154 px to 112 px in the landscape composition, and moved renderer/trajectory metadata from a dedicated row into a single lower-right court overlay.
- Replaced independent Appearance and Bounce controls with one Surface selection shared by court materials, trajectory physics, saved preferences, and rehearsal launches. Older `visualSurface`/`physicsSurface` data migrates to the canonical `surface`, preferring the former physics choice when both were saved.
- Bound setup playback to the configured interval. Overlapping launches now use shared-geometry ball meshes so a new interval can start without cutting off an earlier ball's physical trajectory.
- Replaced coupled saved views with independent local camera-position and perspective preset collections. Legacy views migrate into both collections; clicking applies one side, right-click updates it in place, plus creates a new preset, WASD provides free camera movement, and Reset applies the first item from each collection. The player-view coordinate correction makes A move left and D move right and migrates the legacy built-in Left corner preset.
- Removed the fixed court look-at anchor. The FPV camera now keeps its local orientation while WASD changes position; left-button hold-and-drag adjusts yaw and pitch continuously through 360°, while right-button dragging remains dedicated to shot direction.
- Added a reusable interactive court plan for opponent positioning, with player-view-correct dragging plus baseline, corner, deuce/ad serve, service-line, and net presets shared by Quick Practice and the drill editor.
- Removed the ball-landing modal. Right-click, hold, and drag now raycasts directly from the FPV camera onto the court; `ball-v3-directed-aim` converts that point to azimuth while pace remains launch speed and net clearance solves elevation.
- Added validated per-event `opponentPosition` overrides in the drill editor, including court presets, free dragging, live preview, timeline labels, JSON round-trip, and compile precedence over the session-wide position.
- The renderer moves both the neutral opponent rig and its ball-machine fallback to the active trajectory origin. Receiver-plane crossing no longer ends the solver; repeated bounce/ground samples continue for at least three seconds after first contact.

### Verification

- Commit: `f97ffb7`.
- Direction/lifetime follow-up commit: `2d93e6c`.
- Camera-look follow-up commit: `0b66b43`.
- Setup cleanup/surface-coherence follow-up commit: `e0a124e`.
- `npm test`: 10 files, 80 tests passed, including player-view A/D mapping, mirrored opponent coordinates, deuce/ad serving presets, direct aim direction, overlapping interval playback, legacy Left corner migration, canonical surface migration, three-second post-bounce sampling, angle wrapping, drag accumulation beyond the former limits, and forward/side/vertical/backward orientations.
- `npm run build`: production PWA build passed; the scene chunk is approximately 173.0 kB gzip and the 29-entry generated precache approximately 1.82 MiB.
- In-app browser at 1280 × 720 verified opposite A/D viewpoint movement, removal of the landing modal, the deuce-serve opponent at `1.25, 11.71 m` on the visible left, and a real right-button hold-and-drag that changed landing from `-1.08 m` to `+1.33 m`; the final console had zero errors or warnings.
- A real left-button drag produced yaw `-26.4°` and pitch `+13.7°`, beyond the former `±25°`/`±12°` limits. Eight subsequent A movements preserved both values exactly; repeated horizontal and vertical drags wrapped cleanly past 180°, and the final browser console remained empty of errors and warnings.
- In-app Browser at 1280 × 720 confirmed the offline badge, safety footer, and diagnostics row were absent; the 112 px preset toolbar remained fully usable; one metadata line stayed inside the lower-right court corner; and selecting Clay changed the visible court through the sole Surface control. At 767 × 898 the stacked preset toolbar measured about 196 px, had no horizontal overflow, and did not overlap the look/aim hint. Both viewports had zero console errors or warnings.
- The Browser loop caught and fixed an in-place legacy-state crash during hot replacement. A fresh 1280 × 720 load then rendered the WebGL practice screen with the four presets, split bottom controls, collapsible sections, and zero console errors or warnings.
- At 820 × 1000 the stacked setup had no horizontal overflow, retained both preset groups and the safety notice, and kept the complete landing planner inside the viewport with zero console errors or warnings. The court map also scales down at the 720 px default height so the Done action remains visible without modal scrolling.

### Remaining review gates

- Owner/manual review of WASD movement speed, FPV left/right-drag discoverability and look sensitivity, full inversion comfort, preset naming volume, and physically useful pace/clearance ranges.
- Target-device foreground performance review during continuous FPV aiming and overlapping-ball playback.
