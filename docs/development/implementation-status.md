# V1 implementation status

- **Status:** Active
- **Last updated:** 2026-09-08
- **Current implementation:** Six Blender-authored venues by default, twelve Quality/Performance GLBs, and optional Empty/Half/Full instanced 2D audiences. Procedural venue presentation and the opt-in gate are removed. Existing outdoor Quality geometry, darker grass and denser nets are preserved.
- **Previous venue integration:** Source/assets `25e363b`, runtime `18141c5` and verification `d1a916a` were fast-forwarded into `main`, preserving separately committed local-motion work `b2a082e`. All twelve local feature tips were included at this integration checkpoint; see the [branch audit](feature-branch-integration-2026-09-05.md). No remote push or deployment.

**Motion/model integration checkpoint (2026-09-07):** Local `main` includes all 17 motion/model feature commits plus delivery/documentation reconciliation through `a9ba202`: all 24 clips, the 1.88 m articulated model, recovery planning, crossovers and both serve rhythms. No local feature tip remains unmerged. The 237-test suite, production build, active-asset/cache guard, both-hand gameplay/crossover checks and actual production-browser practice review pass. The [current motion contract](local-motion-pipeline.md) replaces competing “latest” descriptions below; the [integration receipt](motion-main-integration-2026-09-07.md) records the exact merge, evidence and remaining owner/device gates. Older stage counts and asset hashes below are historical evidence, not active selectors. No public deployment occurred.

This is the evidence ledger for the code-backed V1. “Implemented” means runnable code exists; “verified” additionally requires the named automated and browser evidence. The active player is the 1.88 m articulated mannequin with the 25-clip library. [ADR-0012](../decisions/0012-local-opponent-motion-pipeline.md) now makes tennis motion, racket, and connectors local production work in the sibling motion-analysis laboratory, using the supplied videos rather than online mocap services. See the [motion ledger](local-motion-pipeline.md) for current evidence. Venue fidelity is repository-owned implementation work under ADR-0005 rather than a generated-asset dependency.

## Optional ball focus — 2026-09-08

[ADR-0023](../decisions/0023-optional-ball-focus-rendering.md) adds a default-off
Perspective toggle in Practice, drill editing and playback settings. Approaching
balls become lighter and luminous; the surrounding world softens up to the selected
0–6 px ceiling. The depth-tested ball mask remains sharp after resize and respects
occlusion. Focus settings persist independently of pending practice-form saves and
do not reset sessions or remount the court.

Verification: **313 tests / 31 files**, production build/active motion cache guard,
desktop/phone browser flow, keyboard controls, mask/depth readback, pixel comparison
and repeated GPU texture cleanup pass. See the [receipt](ball-focus-2026-09-08.md).
Browser timing samples were too variable for a device-performance conclusion;
thermal qualification, owner acceptance and public deployment remain separate.

## Continuous drill camera and reusable shots — 2026-09-08

[ADR-0022](../decisions/0022-continuous-drill-camera-and-reusable-shots.md) replaces
per-shot camera resets with one clock-driven timeline. Shot views stay fixed through
the incoming flight; movement tracks the opponent with bounded acceleration/braking
and smooth gaze transitions. A camera-relative return rectangle constrains actual
return contacts. Editor controls cover complete shot configuration and local reusable
snapshots; a blue footprint shows return distance/size. Camera gestures commit once,
Test drill preserves unsaved work, and the phone timeline scrolls within the page.

Verification: **309 tests / 30 files**, production build and `check:motion` pass.
Actual rendering matches the camera plan at 336 sampled points across all 16 bundled
drills and a custom sequence. Production-browser authoring, reload persistence,
snapshot independence, one-canvas navigation, gesture commits and 390 px layout pass.
The [camera/editor receipt](drill-camera-and-editor-2026-09-08.md) records bounded
movement measurements and fixes found during review. Local preview refreshed;
owner/device acceptance and public deployment remain separate.

## Earlier prepared stroke entry — 2026-09-08

**Practice form follow-up (2026-09-08):** Removed the Zone center depth, Zone width
and Zone depth sliders from Ball & rhythm. Practice uses the rendered court's
move/resize controls for landing-zone configuration. The production build and
live browser form inspection pass; the existing preview is refreshed.

[ADR-0021](../decisions/0021-prepared-stroke-entry-after-travel.md) adds lab-authored
completed unit-turn boundaries for both drives, slices and volleys. Incoming travel
blends into and holds the prepared pose; gameplay starts the swing after the unit
turn instead of resetting to ready. The shared practice/drill planner reserves the
transition and preserves the authored contact clock. The rebuilt GLB is byte-identical;
phase/entry metadata and runtime sequencing change. Stationary starts and serves
keep full preparation.

Verification: **300 tests / 28 files**, full lab build, post-IK both-hand gameplay,
crossovers, production build and active-asset/cache guard pass. Browser review covers
all six entries, both hands, practice/drill approaches and ordinary playback. The
user's local preview is refreshed. See the [prepared-entry receipt](prepared-stroke-entry-2026-09-08.md)
for evidence and owner/deployment limits.

## Shared court and landing-zone resizing — 2026-09-08

Implementation `32aabe2` applies [ADR-0020](../decisions/0020-shared-court-and-transactional-zone-editing.md). Practice, Editor and drill playback retain one mounted canvas/scene/WebGL context and unchanged venue/opponent assets; the library parks the scene with rendering stopped. Zone interior dragging and anchored side/corner resizing preview only scene geometry while held, then commit one session update and editor undo entry on release. Cancellation restores the model and immediate navigation preserves practice edits. The corner/volley camera positions now aim at opposite-baseline center; annotated explanations are removed and the variation label is **Shot Variation**.

Verification: **288 tests in 27 files**, production/PWA build and active 25-clip motion/cache guard pass. Actual browser checks cover mouse/touch resizing, undo/save, preset framing, responsive layout and one-context/one-asset-load navigation. A bounded drag sample improved 95th-percentile frame intervals from 33.3 ms to 12.6 ms; the library issued no draws while parked. The [shared-court receipt](shared-court-and-zone-resize-2026-09-08.md) records measurements and limits. The local in-app preview is refreshed; owner/device acceptance and deployment remain separate.

## Earlier direct landing-zone interaction — 2026-09-08

Implementation `b90f791` applies [ADR-0019](../decisions/0019-direct-landing-zone-manipulation.md): center/axis arrows are replaced with hover and left-drag on the entire rendered zone. Free court-plane translation preserves the grab offset; a drag beginning outside the zone rotates the camera. Pointer capture keeps the two gestures separate, with touch and camera-relative keyboard access. Narrow preview hints and status text occupy separate rows.

Verification: **281 tests in 27 files**, production/PWA build and the active motion/cache guard pass. Actual browser checks cover diagonal drags, boundary-crossing gesture ownership, clicks, right-button behavior, keyboard/reload persistence, all four practice presets, saved editor zones and mobile touch. The [direct-drag receipt](landing-zone-direct-drag-2026-09-08.md) records the evidence. Local implementation remains distinct from owner acceptance and deployment.

## Earlier landing zones and preview — 2026-09-08

Implementation `97783ed` adds [ADR-0018](../decisions/0018-uniform-landing-zones-and-continuous-preview.md): uniform landing zones across all practice families and drill events, 3D court X/Z arrows, editable zone dimensions, independently seeded parameter variation, and an indefinite setup stream of fresh feeds. Finite launched sessions retain their chosen counts/rests. Natural fitting can slow short half-volleys beyond the earlier ±15% neighborhood while preserving the sampled target; resolved values and infeasible requests remain visible.

Verification: **276 tests in 27 files**, production/PWA build and the 25-clip motion/cache guard pass. Actual browser drags, keyboard axes, practice reload, saved drill dimensions, service bounds, a 55.41-second continuous preview and the 390-pixel layout passed. The [zone receipt](landing-zone-verification-2026-09-08.md) records evidence and remaining acceptance/deployment boundaries. The entries below are earlier checkpoints.

## Earlier practice refinement — 2026-09-08

[ADR-0017](../decisions/0017-independent-practice-clocks-and-natural-targets.md) supersedes the coupled clocks and previous fixed-emitter interpretation. The selected opponent point is the body recovery center; chosen/alternating stroke sides step away from it, while racket contact moves and the landing target stays fixed. Serve roots retain their start. Groundstroke, volley and overhead side selection is explicit, including a new generic authored backhand overhead in the 25-clip bundle.

Stroke rhythm, shot interval and preferred movement pace are separate in practice, drills, editor and storage. Push-off/cruise/braking use a deterministic distance curve and torso lean; a zero-distance recovery still budgets its turn. The low-angle trajectory branch removes heading-induced lob jumps; Natural target exposes bounded adjustments, while Exact speed & spin retains those values. First-bounce arrows support dragging, click steps and keyboard arrows. Editing Return's automatic placement switches to a custom legal service-box target; its T/Body/Wide pattern remains selectable.

Verification: 255 tests in 24 files, production/PWA build and selected-bundle cache guard pass. Full 25-clip export/choreography/anatomy, 13-shot sequences per hand, 38 movement sweeps and crossover support checks pass. Production browser evidence and the failure/fix ledger are in [practice refinement](practice-refinement-2026-09-08.md). Owner technique acceptance, device qualification and public deployment remain separate. The following checkpoint describes the earlier integration before ADR-0017.

## Gameplay rhythm and rally integration — 2026-09-08

Local implementation under [ADR-0015](../decisions/0015-mode-aware-gameplay-rhythm.md) and [ADR-0016](../decisions/0016-bounded-rally-arcs-and-drill-pace.md): fixed-home Quick Practice, adaptive drill recovery/direct routes, shared percentage rhythm and source-clock scaling, time-dependent receiver coverage and physics-solved return links. Setup and editor previews share the rehearsal compiler. The Corner switch drill now has explicit opponent sideline positions. Quick-practice overheads expose the existing proxy without a self-toss. Legacy intervals import into the relative rhythm model; new controls and saved overrides use percentages.

The 247-test suite (23 files), `npm run check:motion` and the production/PWA build pass. New coverage includes complete quick-practice and fast/short-rest drill root continuity, both hands and all eight stroke clips after IK at 0.85/1/1.2 rates, receiver/camera behavior, return handoffs, contact tolerance, deterministic seeking and legacy migration. The selected 24-clip asset remains unchanged. Browser verification is recorded in [gameplay integration](gameplay-rhythm-integration-2026-09-08.md); owner technique/calibration acceptance, device qualification and public deployment remain separate.

## Historical motion checkpoint — revision 10, 2026-09-06

Revision 10 corrects the service setup in the player's facing frame (left foot ahead, parallel toes), moves the cocking forearm away from the head, and internally rotates the airborne recovery thigh. The release receives 50 ms more time before the unchanged contact. Gameplay foot correction preserves the service knee plane. Active asset: `tennis-local-v1.e21e894bfe91.glb`; all 22 other clips are exactly preserved. All 240 Hz export/anatomy/choreography and both-hand gameplay checks pass. **219 frontend tests / 22 files, 20 lab JavaScript tests, four Python rhythm tests and production build** pass. Live service playback passes for both hands. [Current motion contract and evidence](local-motion-pipeline.md). Ready for owner review.

### Preserved stroke foundation

Revision 8 applies rear-reference forehand rhythm and a deeper rear-fence takeback. Follow-up review makes the hitting zone steady: a nearly fixed 48-degree elbow and a racket head that drops below impact, then rises through contact and extension. It also delays backhand pelvis opening, corrects serve stance/carry/toss tilt and holds the forehand volley sideways through the punch. The complete asset is `tennis-local-v1.ec377a9fb3e3.glb`; eleven unaffected clips have identical decoded tracks. All 240 Hz export/anatomy/choreography and both-hand gameplay checks pass, with maximum contact error 0.0012 mm. **208 frontend tests / 21 files, 20 lab JavaScript tests, four Python rhythm tests and production build** pass. Browser playback and post-IK frame checks pass. Lab implementation/evidence: `711f983`. [Current motion contract and evidence](local-motion-pipeline.md). Ready for owner technique review.

### Volley addition before revision 7

The preceding addition built separate **forehand-volley and backhand-volley** clips from the owner's UCLA regions near 22:48 and 22:39. Both use compact continental preparation, forward step, one-handed punch and shared ready recovery. Backhand preparation uses the support hand at the throat before release. Volley family now selects the new technique before legacy spin labels, including existing presets and practice controls. The 15-clip, 2.43 MB library passes 240 Hz anatomical/choreography gates; old slice proxies fail the new volley checks. Mixed gameplay passes 11 events for each hand after blending/IK, with maximum contact error below .002 mm. **208 tests / 21 files**, 20 JavaScript lab tests, four Python rhythm tests and production build pass. Browser review covers volley phases, source playback, mirrored contacts and run/walk transitions; no browser errors/warnings were captured. The new asset is precached offline. [Current contract and evidence](local-motion-pipeline.md). Owner technique review remains open.

### Preserved revision-6 corrections

Revision 6 follows the owner's six annotated images and accompanying review. Forehand lifts the preparation elbow, extends into a deep pronated takeback and loads with a horizontal closed racket. Backhand widens its high two-hand preparation and smooths the drop. Both groundstrokes build speed into contact and decelerate through the finish, with measured racket-speed graphs in MotionLab. Serve raises the tossing shoulder while keeping the early racket down. Ready, split and travel use a shared two-hand belly/chest-level carry, forward hip/trunk lean and gait-synchronized sway. Existing local references and uniform gameplay speed scaling remain.

The 2.15 MB library bakes at 120 Hz. All 13 clips pass 240 Hz anatomical/choreography gates with zero glTF errors/warnings; the new gates reject 11 revision-5 clips. The real controller passes both hands after blending and foot IK with zero joint violations, .079 m minimum backhand finish head-proxy clearance and less than .001 mm maximum contact error. **202 tests / 21 files**, 20 JavaScript lab tests, four Python rhythm tests and production build pass. The asset remains precached offline. Browser review includes marked poses, ordinary playback and the complete ten-event demo; no browser errors occurred, with one GPU shader precision warning. [Current contract, source limits and evidence](local-motion-pipeline.md). Owner technique approval remains open. Historical notes below describe their original stages.

## Venue delivery — six Blender scenes, performance and audience

Three original indoor halls now include complete structure, trusses/clerestories, seating banks and circulation, original baked PBR textures, court equipment and fixture-aligned lighting with cached indoor bounce fill. All six low-detail assets reduce model triangles by 81–89% and payloads by 54–84%. Performance is selected before GLB download; Auto can step down on small screens or sustained slow rendering. Only the active venue remains resident.

Audience cards use generated front/back atlases, two triangles per seat, deterministic exact Half occupancy and spatial instancing. Empty requests no audience resources. Preferences persist and flow into practice. Hash/registration checks, cancellation and retry protect the authored-only boundary. [Build, measured budgets and limitations](indoor-venues-and-performance.md), [Stage 18 browser evidence](visual-verification.md#stage-18-six-blender-venues-performance-and-seated-audiences--2026-09-05).

Verification: **179 tests / 21 files**, production build, all twelve decoded GLBs, asset-budget checks and production browser verification pass. Detailed outdoor rendering remains GPU-heavy; Performance/Auto is the lower-cost option, not a universal frame-rate guarantee. 2D spectators are not suitable for very close edge-on inspection. Owner art approval and deployment remain open.

## Previous venue refinement — grass contrast and shared net density

The grass palette changes from `#839d49` to `#64843d` without changing white lines, textures' registration, lighting or physics. All three Blender masters/exports now use nominal 42 mm weave spacing with 2.2 mm radius cords; all procedural venue nets have tighter spacing and calibrated screen-line coverage. Current hashes/sizes are recorded in [Blender venues](blender-venues.md#current-assets--shared-net-refinement-2026-09-05). Superseded GLBs are removed from shipped output and recoverable in Git history.

Verification: **158 tests / 17 files**, production build and three Blender builds pass; raw glTF validators report zero errors/warnings. Decoded tests check actual net triangle counts, cord thickness, extent and grass albedo. Production desktop/mobile comparison, three authored and six fallback selections, and grass day/dusk/night pass with zero warm-loop console issues. See [Stage 17](visual-verification.md#stage-17-grass-contrast-and-all-venue-net-density--2026-09-05). Existing target-device performance, owner visual approval and deployment gates remain open.

## Previous delivery — third Blender-authored outdoor arena

The neutral Grass Open Arena is built in Blender and integrated under the existing `grass-center-court` ID: 14,381 linked green seats, three rake profiles, court-aligned straight stands and rounded corner fans, exact 22 × 41 m striped lawn, original baseline pavilion, clear recessed player entrances, a dark canopy and two parked white concertina banks. The 18.76 MB packed master exports to a 6.06 MiB GLB. Reference names/logos are excluded from runtime identity. Published versus estimated dimensions and the owner-recommended ArtStation study are documented in [Grass arena](grass-arena.md); [ADR-0011](../decisions/0011-blender-grass-arena.md) preserves the runtime/fallback boundary.

Verification: **154 tests / 16 files**, production build and Cycles source render pass. Actual exported geometry/hash/material/UV/seat/roof/access tests and native-grass manager checks pass; glTF validation reports zero errors/warnings. Production desktop/mobile day/dusk/night and camera/venue switches pass with no warm-loop console errors/warnings. Final-hash offline reload, forced grass-load failure and zero-download default main path are verified. Hard/clay masters and exports are unchanged. See [Stage 16](visual-verification.md#stage-16-third-blender-arena--garden-grass--2026-09-05).

Target-device frame-time/memory/cold-load profiling, owner visual approval and deployment remain open. The transmission pass and concurrent residency of three loaded venues need profiling; the default remains procedural. Roof banks are statically open, not animated. No crowd, surrounding real precinct or structural certification is included.

## Previous delivery — second Blender-authored outdoor arena

The Philippe-Chatrier-informed clay venue is built in Blender and integrated under the existing optional authored-venue switch, alongside hard. It retains 13,664 ash seats in four court-aligned stands: fixed seat columns, perpendicular section aisles, aligned terrace entrances and rectangular front boxes, with symmetric fans confined to chamfered corners. Roof revision 4 uses denser rough-transmission ivory membranes and continuous readable court shade instead of distracting truss-only stripes; exposed framing and ten overlapping wings remain fixed halfway open. Green perimeter entrances, original clay textures and the glazed concourse remain. Both variants retain regulation gameplay registration, shared runtime lighting and procedural loading/failure/offline fallback. The default remains procedural; the hard asset is unchanged. [ADR-0010](../decisions/0010-blender-clay-arena-and-multi-venue-boundary.md), [build/source details](clay-arena.md) and [Stage 15 visual evidence](visual-verification.md#stage-15-clay-roof-opacity-and-even-court-shade--2026-09-05) define the current boundary.

Verification: 146 tests / 15 files and production build pass; actual GLB hash/decode/anchors/seats/clearance, fixed seat-column/aisle-edge checks, half-open roof/overlap/transmission checks and loader shadow/cutaway tests pass. Production day/dusk/night and desktop/mobile checks pass; roof cutaway and hard/procedural venue switches restore full-strength shadows. The existing transmission pass still needs target-device profiling; revision 4 restores eleven membrane shadow casters without adding a shadow map. Both cached assets offline, forced clay-load failure and zero-download default path were exercised in the initial integration; the full failure matrix was not re-exhausted for this roof refinement. Target-device frame-time/memory/cold-load profiling, owner visual sign-off, tennis mocap and public deployment remain open; this is local implementation, not release approval.

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

- Full camera calibration across eye height, longitudinal/lateral position, yaw, pitch, and 5–160° horizontal FOV; physical screen width/height plus viewing distance calculate both horizontal and vertical FOV and preserve exact court geometry.
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
- Added canvas-scoped wheel zoom: wheel up narrows horizontal FOV, wheel down widens it, both the slider and wheel share a 5°–160° clamp, and scrolling outside the court retains normal page behavior.
- Added a reusable interactive court plan for opponent positioning, with player-view-correct dragging plus baseline, corner, deuce/ad serve, service-line, and net presets shared by Quick Practice and the drill editor.
- Removed the ball-landing modal. Right-click, hold, and drag now raycasts directly from the FPV camera onto the court; `ball-v3-directed-aim` converts that point to azimuth while pace remains launch speed and net clearance solves elevation.
- Added validated per-event `opponentPosition` overrides in the drill editor, including court presets, free dragging, live preview, timeline labels, JSON round-trip, and compile precedence over the session-wide position.
- The renderer moves both the neutral opponent rig and its ball-machine fallback to the active trajectory origin. Receiver-plane crossing no longer ends the solver; repeated bounce/ground samples continue for at least three seconds after first contact.

### Verification

- Commit: `f97ffb7`.
- Direction/lifetime follow-up commit: `2d93e6c`.
- Camera-look follow-up commit: `0b66b43`.
- Setup cleanup/surface-coherence follow-up commit: `e0a124e`.
- Wheel-zoom/FOV follow-up commit: `28f88c9`.
- `npm test`: 10 files, 81 tests passed, including player-view A/D mapping, mirrored opponent coordinates, deuce/ad serving presets, direct aim direction, overlapping interval playback, legacy Left corner migration, canonical surface migration, three-second post-bounce sampling, angle wrapping, drag accumulation beyond the former limits, forward/side/vertical/backward orientations, and wheel-FOV direction/clamping.
- `npm run build`: production PWA build passed; the scene chunk is approximately 173.1 kB gzip and the 29-entry generated precache approximately 1.82 MiB.
- In-app browser at 1280 × 720 verified opposite A/D viewpoint movement, removal of the landing modal, the deuce-serve opponent at `1.25, 11.71 m` on the visible left, and a real right-button hold-and-drag that changed landing from `-1.08 m` to `+1.33 m`; the final console had zero errors or warnings.
- A real left-button drag produced yaw `-26.4°` and pitch `+13.7°`, beyond the former `±25°`/`±12°` limits. Eight subsequent A movements preserved both values exactly; repeated horizontal and vertical drags wrapped cleanly past 180°, and the final browser console remained empty of errors and warnings.
- In-app Browser at 1280 × 720 confirmed the offline badge, safety footer, and diagnostics row were absent; the 112 px preset toolbar remained fully usable; one metadata line stayed inside the lower-right court corner; and selecting Clay changed the visible court through the sole Surface control. At 767 × 898 the stacked preset toolbar measured about 196 px, had no horizontal overflow, and did not overlap the look/aim hint. Both viewports had zero console errors or warnings.
- In-app Browser wheel input at 1280 × 720 changed horizontal FOV `70° → 61° → 79°` for zoom-in then zoom-out, kept page scroll at zero over the canvas, and cleared the active perspective preset. At 767 × 898, canvas wheel input changed `79° → 73°` without moving the page, while the same wheel input outside the canvas scrolled the page normally; the FOV control exposed the full 5°–160° range and the console had zero errors or warnings.
- The Browser loop caught and fixed an in-place legacy-state crash during hot replacement. A fresh 1280 × 720 load then rendered the WebGL practice screen with the four presets, split bottom controls, collapsible sections, and zero console errors or warnings.
- At 820 × 1000 the stacked setup had no horizontal overflow, retained both preset groups and the safety notice, and kept the complete landing planner inside the viewport with zero console errors or warnings. The court map also scales down at the 720 px default height so the Done action remains visible without modal scrolling.

### Remaining review gates

- Owner/manual review of WASD movement speed, FPV left/right-drag discoverability and look sensitivity, full inversion comfort, preset naming volume, and physically useful pace/clearance ranges.
- Target-device foreground performance review during continuous FPV aiming and overlapping-ball playback.

## Stage 9 — shot-aware practice physics and reliable movement

- **Status:** Implemented locally on 2026-08-30; instrumented trajectory, measured-surface, and player-perception calibration remain external validation gates
- Replaced the mixed Quick Practice spin list with a Shot type selector. Groundstroke exposes Flat, Topspin, and Slice; Serve exposes Flat, Slice, and Kick; Volley is explicitly spin-free.
- Added shot profiles for contact height, opponent origin, pace range, net clearance, legal spin, and default target. Serve launches originate at 2.75 m and solve into the diagonally opposite regulation service box; Volley moves the opponent to 3.7 m from the net and uses a lower, slower launch.
- Reworked `ball-v4-shot-profiles` around a 57.7 g, 67 mm tennis ball, `Cd = 0.55`, spin-dependent Magnus lift, measured-style serve spin magnitudes, and `0.55 mR²` rotational inertia. Spin axes now correspond to topspin/backspin about the cross-court horizontal axis and side curve about the vertical axis.
- Replaced scalar horizontal retention with normal restitution, Coulomb-limited contact friction, translation/spin transfer, impact-speed correction, and rolling resistance. Hard, clay, and grass retain separate response profiles.
- Added a persisted 0.60×–1.40× Bounce height control under a collapsible Ball arrival section. The factor defaults to 1.00× and multiplies only the first post-impact normal velocity after the selected surface response; it cannot change launch, net clearance, wind, or first landing.
- Rebuilt WASD as held-key, request-animation-frame movement with elapsed-time scaling, normalized diagonals, immediate tap response, Shift acceleration, and cleanup on key release, blur, hidden tabs, dialogs, and unmount. Setup selects, sliders, and buttons no longer intermittently capture movement.
- Recorded source constraints, runtime decisions, explicit product calibration values, and remaining external gates in [Ball flight and impact calibration](../research/ball-flight-impact-calibration.md).

### Verification

- Implementation commit: `2acad7d`.
- `npm test`: 10 files, 92 tests passed, including all three groundstroke and serve spin families, legal service-box landings, spin-free Volley normalization, horizontal surface-friction ordering, first-impact-only bounce adjustment, deterministic wind, and held/diagonal WASD behavior.
- `npm run build`: production PWA build passed; scene and setup chunks remain split and the 29-entry generated precache remains approximately 1.83 MiB.
- In-app Browser at 1280 × 720 verified Return selecting Serve at 135 km/h and 2.75 m contact, with Flat and Kick producing different legal metadata (`-0.12, -5.09 m` versus `-0.12, -4.04 m`). Volley moved the opponent to `0.0, 3.7 m`, exposed only disabled `None` spin, and landed at `0.00, -4.64 m`.
- Pressing A while the Shot type select retained focus cleared the active Baseline camera preset without changing the shot, directly verifying that setup-control focus no longer blocks movement. At 767 × 898 the configuration remained stacked without horizontal overflow; both viewports had zero console errors or warnings.

### Remaining review gates

- Compare flight and post-bounce samples with instrumented ball tracking, and fit profiles to measured court-specific restitution/friction before describing them as venue-measured.
- Coach/player review of contact heights, default pace/clearance, serve target margins, Bounce height adjustment, and held-key movement speed on the intended display and input hardware.

## Stage 10 — independent landing depth and lob feeds

- **Status:** Implemented locally on 2026-08-30; owner trajectory-feel and instrumented calibration remain open
- Reproduced the original failure numerically. The old minimum-clearance solve placed 55–75 km/h topspin groundstrokes only about 1.8–7.4 m beyond the net across the full clearance range; at 35 km/h the first bounce occurred before the net and the recorded crossing happened afterward.
- Added persisted Landing depth for Groundstroke, Volley, and Lob, measured from the net toward the receiving baseline. Pace remains the exact launch-speed magnitude and Net clearance is a minimum obstacle constraint rather than a hidden proxy for depth.
- Replaced the one-angle directed solve with `ball-v5-depth-intent`: it samples the physically valid fixed-speed angle envelope, rejects pre-net bounces and insufficient clearances, refines the closest target, selects the lower branch for Groundstroke/Volley and high branch for Lob, and leaves impossible requests visibly unresolved instead of silently increasing speed.
- Changed the Rally product default to a recreational 68 km/h with a 9.5 m landing target. The exposed pace floor is now 45 km/h from a baseline origin; lower physically impossible baseline feeds are no longer offered by that profile.
- Added Lob as the fourth Quick Practice shot type with flat/topspin/slice, a 1.05 m contact from `1.1, 6.0 m`, 52 km/h default pace, 3.2 m minimum clearance, 9.3 m default landing depth, and a bounded high arc. The Overhead rail preset now selects this incoming lob rather than reusing Volley.
- Added target-versus-resolved depth feedback. When pace, spin, clearance, origin, wind, and depth cannot coexist, setup explicitly labels the closest physically reachable result.
- Updated local preference migration, compiled-session metadata, rehearsal summaries, product requirements, architecture, release matrix, and the research calibration note.

### Verification

- Implementation commit: `817ac8a`.
- `npm test`: 10 files, 96 tests passed. New evidence preserves 68 km/h launch magnitude while landing a flat Groundstroke within 0.25 m of a 10.0 m target, keeps attainable depth stable across pace/clearance changes, bounds Lob apex between 5.0 and 8.5 m, compiles Overhead as Lob, and clamps migrated depth/profile settings.
- `npm run build`: production PWA build passed; Setup is approximately 7.68 kB gzip, SceneViewport approximately 173.12 kB gzip, and the 29-entry precache approximately 1.83 MiB. The existing large-scene-chunk warning remains.
- In-app Browser at 1280 × 720 verified Rally → Groundstroke/Flat at 68 km/h with a 9.5 m target resolving at `0.00, -9.50 m`. Overhead selected Lob/Topspin, moved the opponent to `1.1, 6.0 m`, applied 52 km/h and 3.2 m clearance, and resolved its 9.3 m target at `0.96, -9.29 m` with a 6.23 m net-crossing height.
- At 767 × 898 the active Overhead/Lob preset and court remained stacked with `scrollWidth = clientWidth = 752`; the final browser console contained zero warnings or errors. Browser-reported FPS was not accepted as foreground performance evidence.

### Remaining review gates

- Coach/player review of whether Landing depth should use metric distance, named zones, or both, and whether the 68 km/h Groundstroke and 52 km/h Lob defaults feel appropriate on the target display.
- Instrumented comparison of the chosen low/high angle branches, particularly recreational topspin and lob apex, before labeling the profiles measured rather than research-calibrated.

## Stage 11 — continuous spin target practice and trajectory inspection

- **Status:** Implemented locally on 2026-08-31; instrumented spin-decay calibration and owner tooltip readability review remain open
- Replaced the Quick Practice `pace` contract with explicit Launch speed while retaining km/h as the scalar magnitude. Removed Net clearance from the user-facing contract; shot profiles retain a minimum obstacle constraint inside the solver.
- Added persisted shot-aware Spin rate in rpm beside Spin type. Groundstroke, Serve, and Lob use bounded type-specific ranges/defaults; Volley remains zero-spin. Legacy `pace` preferences migrate to Launch speed and stale clearance values are discarded.
- Upgraded to `ball-v6-spin-target`. Spin axes now rotate with the shot heading, continuous rpm sets the normalized angular magnitude, and free-flight spin decays by about 2% per 6.4 m before surface impulse coupling.
- Landing depth now applies to Serve as well as Groundstroke, Volley, and Lob; service targets remain clamped to the diagonally opposite regulation box. Quick Practice exposes only target intent and does not add a raw-angle/manual-ballistics mode.
- Removed fixed calculated diagnostics from setup/rehearsal panels. Hovering any visible trajectory segment projects and interpolates the nearest physical sample and displays time, height, current speed, launch speed, rpm, solved angle, apex, real net clearance, landing/error, bounce speeds, and receiver state directly over the court.

### Verification

- Implementation commit: `ffa03d7`.
- `npm test -- --run`: 10 files, 99 tests passed. Added continuous-rpm preservation/target solving, profile clamping, and screen-space segment interpolation to the existing legality, surface, wind, bounce, persistence, and post-contact coverage.
- `npm run build`: production PWA build passed; Setup is approximately 7.52 kB gzip, SceneViewport approximately 174.27 kB gzip, and the 29-entry precache approximately 1.88 MiB. The existing large-scene-chunk warning remains.
- In-app Browser at 1280 × 720 verified a clean target-practice panel with Launch speed, Spin type/rate, Landing depth, and no exposed Net clearance or calculated readout. Hovering Groundstroke/Topspin showed 1,814 rpm and a zero landing error; selecting Slice recomputed the tooltip to 1,253 rpm, 17.4° launch, and a 2.81 m apex.
- Selecting Lob applied 52 km/h, 1,199 rpm topspin, and a 9.3 m target. Hovering its high arc reported a 54.2° solved launch, 6.53 m apex, 5.31 m actual net clearance, 0.12 m target error, bounce speeds, and arrival state. The final browser console contained zero warnings or errors.

### Remaining review gates

- Fit spin decay, type-specific axes, and RPM ranges against instrumented ball tracking before describing them as measured rather than research-calibrated.
- Coach/player review of tooltip density/readability and whether the selected launch-speed, spin-rate, and depth ranges feel natural on the target display.

## Stage 12 — six-venue catalogue and camera-relative navigation

- **Status:** Implemented locally on 2026-08-31; owner camera-speed/height comfort and final venue visual review remain open
- Replaced the nine-entry venue catalogue with exactly three Outdoor Arena and three Indoor Court choices, each named by the same setting/surface template for hard, clay, and grass.
- Removed the outdoor club, clay terrace, and grass park builders from the runtime. Stored selections for those scenes migrate to the retained arena with the matching surface; generic legacy outdoor selections migrate to Outdoor Arena · Hard.
- Changed WASD from fixed court-axis movement to a normalized horizontal basis derived from the current 360-degree camera yaw. Pitch remains view-only, so looking up or down does not introduce unintended vertical travel.
- Added bounded eye-height movement from 0.4 m through 8.0 m, while retaining frame-rate-independent held input, Shift acceleration, A/D strafing, and preset invalidation after free movement. The final browser-reserved Ctrl+W/S contract is recorded in Stage 17.
- Added ADR-0007 and updated the product, architecture, roadmap, and release contracts to make the six-scene catalogue and new camera coordinate system authoritative.

### Verification

- Implementation commit: `8b0c90f`.
- Focused registry, storage, renderer, and camera-control run: 4 files, 29 tests passed. Full `npm test -- --run`: 10 files, 101 tests passed.
- `npm run build`: production PWA build passed; Setup is approximately 7.61 kB gzip, SceneViewport approximately 170.95 kB gzip, and the 29-entry precache approximately 1.87 MiB. The existing large-scene-chunk warning remains.
- In-app Browser at 1280 × 720 exposed exactly `Outdoor Arena · Hard/Clay/Grass` and `Indoor Court · Hard/Clay/Grass`; Indoor Court · Grass rendered successfully before the default hard arena was restored.
- Browser interaction rotated yaw to 88° and accepted W as movement from that sideways view. The earlier automation also injected Ctrl+W/S into the page and visibly raised then restored the viewpoint, but that injection bypassed browser chrome and was not evidence that a physical Ctrl+W could be intercepted; Stage 17 supersedes that claim.

### Remaining review gates

- Owner comfort review of normal/Shift horizontal speed, vertical speed, and the 0.4–8.0 m height envelope on the target display.
- Final owner visual approval for the three retained outdoor arenas and three indoor courts; browser FPS shown during background automation is not accepted as foreground performance evidence.

## Stage 13 — ITF-runoff opponent positioning

- **Status:** Implemented locally on 2026-08-31; owner drag-precision and extreme-source trajectory review remain open
- Added the 2026 ITF international-competition clearances to the court domain: 6.40 m behind each baseline and 3.66 m outside each doubles sideline. Opponent placement now spans `x = ±9.145 m` and `z = ±18.285 m` in both Quick Practice and the drill editor.
- Rebuilt the shared SVG court plan at one physical scale so the complete runoff surrounds the regulation markings. Added visible back/side runoff labels and a desktop two-column modal layout that enlarges the plan without changing the compact layout contract.
- Moved the regular Groundstroke/Rally origin and baseline/corner presets to 1.0 m behind the far baseline (`z = 12.885 m`). Serve, volley, service-line, and net origins remain shot-specific.
- Migrated the exact former Rally default `(0, 11.235)` to the new runback, clamp saved preferences to the shared envelope, and validate imported per-event opponent positions against the same bounds.
- Added ADR-0008 and updated the product, architecture, and release contracts with the official source and the distinction between facility clearance and the product-selected one-metre rally runback.

### Verification

- Implementation commit: `e28d6b4`.
- Focused opponent, storage, content-validation, trajectory, and session run: 5 files, 81 tests passed. Full `npm test -- --run`: 10 files, 105 tests passed.
- `npm run build`: production PWA build passed; CourtPlan is approximately 1.51 kB gzip, Setup approximately 7.66 kB gzip, SceneViewport approximately 170.94 kB gzip, and the 29-entry precache approximately 1.87 MiB. The existing large-scene-chunk warning remains.
- In-app Browser at 1280 × 720 confirmed the modal text and runoff labels, placed the opponent at `9.14, 18.06 m` in simultaneous side/back runoff, and restored Baseline center to `0.00, 12.88 m`. The opponent-setting button retained `0.0, 12.9 m` after closing the modal.
- At 767 × 898 the expanded modal remained fully visible with `scrollWidth = clientWidth = 752`; both browser passes ended with zero console warnings or errors. Browser-reported background FPS is not accepted as target-device performance evidence.

### Remaining review gates

- Owner/coach review of whether one metre is the preferred neutral Rally runback and whether an additional deep-recovery preset would be useful.
- Target-device pointer/touch review at the extreme runoff edges, plus content review for intentionally authored shots whose source is far enough away that the solver reports a closest reachable landing rather than the exact target.

## Stage 14 — optic ball and outlined-opponent visibility

- **Status:** Implemented locally on 2026-08-31; target-display and production-mocap review remain open
- Replaced the previous yellow-biased ball with one shared optic yellow-green PBR presentation for every active ball instance. Standard and high-contrast modes retain felt-like roughness and use bounded emissive lift; trajectory/trail cues use the same color family.
- Re-materialized the neutral opponent as warm white and added a near-black inverted-hull shader clone for every visible mesh. Skinned clones share the live skeleton, geometry, and animation deformation with their fill mesh.
- Kept the 45 mm hull entirely in the presentation layer: it writes no depth, casts no shadow, ignores fog/tone mapping, and cannot affect opponent scale, collision, placement, or ball physics.
- Recorded that the ITF permits white or yellow but does not publish a numeric yellow/fluorescence standard. The selected sRGB values are renderer calibration informed by common manufacturer "optic yellow" language, not an ITF color claim.

### Verification

- Implementation commit: `6591368`.
- Focused rendering/playback run: 2 files, 7 tests passed. Full `npm test -- --run`: 11 files, 108 tests passed. New coverage checks yellow-green hue/saturation, bounded emissive lift, back-face/depth/tone-map outline settings, vertex expansion, and shared skinned-skeleton identity.
- `npm run build`: production TypeScript/Vite/PWA build passed; SceneViewport is approximately 171.38 kB gzip and the 29-entry precache approximately 1.83 MiB. The existing large-scene-chunk warning remains.
- In-app Browser comparison at the normal desktop viewport verified the optic ball and black-edged white opponent against Outdoor Arena · Hard and Indoor Court · Hard. Selecting Return exercised a changed serve origin and live ball feed without renderer warnings.
- At 767 × 898 the white/outlined opponent remained legible in the compact court view with `scrollWidth = clientWidth = 752`; desktop and compact passes ended with zero console warnings/errors.

### Remaining review gates

- Owner approval on the intended TV/monitor and across all retained venue/light combinations.
- Firefox/Safari comparison plus real production mocap and racket poses to catch browser antialiasing or outline seam differences.

## Stage 15 — receiver-oriented Quick Practice Volley preset

- **Status:** Implemented locally on 2026-08-31; owner feed-speed/depth review remains open
- Corrected the Volley rail preset so its name describes what the user practices rather than the opponent's source stroke. It retains the `position-net` user camera but now places the opponent at the regular Rally origin, 1.0 m behind the far baseline (`0.0, 12.885 m`).
- Changed the preset's incoming family from Volley to Groundstroke, applying the ordinary 68 km/h Topspin feed and deep 9.5 m landing target. This provides a baseline passing/feed ball for the user to intercept near the net.
- Preserved the explicit Volley value in the Shot type control. Selecting it deliberately still uses the spin-free 62 km/h opponent-volley profile at `0.0, 3.7 m`; only the left-rail setup composition changed.

### Verification

- Implementation commit: `f11568c`.
- Focused preset, trajectory, and session run: 3 files, 58 tests passed. Full `npm test -- --run`: 12 files, 110 tests passed. New contract coverage locks the Volley rail to `position-net`, `DEFAULT_RALLY_OPPONENT_POSITION`, and Groundstroke while proving the explicit opponent Volley profile remains present.
- `npm run build`: production TypeScript/Vite/PWA build passed; Setup is approximately 7.65 kB gzip and the 29-entry precache approximately 1.83 MiB. The existing large-scene-chunk warning remains.
- In-app Browser at 1280 × 720 verified `Volley setup`, `Groundstroke · Topspin`, `Opponent 0.0, 12.9 m`, and the active `At the net` camera in one state. The far opponent remained visibly behind the baseline.
- At 767 × 898 the same preset summary and court relationship remained visible with `scrollWidth = clientWidth = 752`; desktop and compact checks ended with zero console warnings/errors.

### Remaining review gates

- Owner/coach review of whether 68 km/h Topspin and a 9.5 m eventual landing are the preferred default volley feed, or whether the receiver-oriented preset needs its own baseline-feed speed/depth profile without changing opponent location.

## Stage 16 — receiver-side Return setup and serve placement cycle

- **Status:** Implemented locally on 2026-08-31; owner serve-placement calibration remains open
- Changed the Return rail preset from the center Baseline camera to the Left corner receiver camera. Added a mirrored Right corner built-in so the user can switch receiver sides without coupling that choice to the perspective preset.
- Mirrored the opponent to the service side diagonally opposite the selected receiver corner. Both serving positions now stand 0.35 m behind the far baseline (`z = 12.235 m`) rather than 0.18 m inside it; persisted legacy built-in cameras and serve origins migrate forward to the corrected contract.
- Added one shared Return target contract for T, Body, and Wide locations inside the receiver-side service box. The setup preview cycles the three placements at the configured interval, and the compiled rehearsal repeats the same deterministic order across the full set.
- The Return summary announces receiver side and current placement. Launched rehearsal readouts use the explicit `T serve`, `Body serve`, and `Wide serve` labels instead of unrelated bundled direction metadata.

### Verification

- Implementation commit: `beba108`.
- Focused preset, storage, court, and session run: 4 files, 59 tests passed. Full `npm test -- --run`: 12 files, 115 tests passed.
- `npm run build`: production TypeScript/Vite/PWA build passed; Setup is approximately 7.98 kB gzip, Rehearsal approximately 4.91 kB gzip, and the 29-entry precache approximately 1.88 MiB. The existing large-scene-chunk warning remains.
- In-app Browser at 1280 × 720 verified the default Left corner and selectable Right corner, mirrored legal server origins (`-1.3, 12.2 m` and `+1.3, 12.2 m`), and the setup timer advancing T → Body → Wide at the configured 4.5-second interval.
- The launched practice exposed `T serve · Service box`, `Body serve · Service box`, and `Wide serve · Service box` on consecutive repetitions. At 767 × 898 the Return summary and court remained free of horizontal overflow; the final browser console contained zero warnings or errors.

### Remaining review gates

- Owner/coach review of the selected T (`0.28 m`), Body (`2.25 m`), and Wide (`3.895 m`) service-box offsets and whether the default Return entry should remain Left corner or remember the last explicitly selected receiver side.

## Stage 17 — protected camera-height shortcuts

- **Status:** Implemented and verified in the in-app Chromium browser on 2026-08-31; physical-key and cross-browser policy review remain open
- Corrected the earlier capture-listener assumption: a normal webpage cannot reliably cancel browser-chrome Ctrl+W because the browser may consume it before dispatching a cancelable DOM event. The earlier in-app automation reached the page directly and therefore did not exercise that boundary.
- Added an explicit `Protect Ctrl+W/S` control. From that user gesture, the setup requests fullscreen with the modern `keyboardLock: 'browser'` option and uses the legacy `navigator.keyboard.lock()` path only when that fullscreen option is unsupported. This avoids double-registering the lock in browsers that already acquired it through fullscreen. Only after acquisition succeeds does Ctrl+W/S raise or lower the camera. Leaving fullscreen or selecting Unlock releases the lock, and failed or unsupported requests remain visible through the control's state and explanation.
- Added Page Up/Page Down as the conflict-free height binding outside protected mode. Unlocked Ctrl+W/S are deliberately not treated as camera input, preventing synthetic page-event tests from implying browser-chrome protection that is not active.
- Added a 0.40–8.00 m Camera height slider to the expandable Perspective section. It shares the live eye-height state used by keyboard movement and camera-position presets; manual height changes clear only the stale position selection and preserve the selected POV preset.
- Preserved bounded, held-key movement, Shift acceleration, focused-field behavior for protected height input, modal movement suppression, preset invalidation, and the live metric height output. Help now explains the permission/fullscreen requirement and Escape exit path.

### Verification

- Implementation commits: `2368198`, `0b47910`, `5ba0afa`, `6f06e3b` (supersede the incomplete `4cdddfc` capture-listener approach).
- Focused camera-control run: 1 file, 10 tests passed. Full `npm test -- --run`: 12 files, 120 tests passed.
- `npm run build`: production TypeScript/Vite/PWA build passed; the existing large-scene-chunk warning remains.
- A clean in-app Browser run at `http://localhost:4173/` activated the protected state (`Unlock Ctrl+W/S`, `aria-pressed=true`), changed height from 2.00 m to 2.04 m with Ctrl+W, restored it to 2.00 m with Ctrl+S, retained the same URL and single open tab, and reported zero browser warnings or errors. A screenshot confirmed that the active control, live height, presets, and court remained visible without toolbar overlap.
- The Perspective slider rendered at desktop width with the shared 1.70 m value. Changing live height to 1.74 m updated the slider, court metadata, and bottom-bar metric together, cleared the Baseline position selection, retained the Natural POV selection, and produced no browser warnings or errors.
- This protocol-driven browser interaction verifies the application route and active fullscreen-lock state. A human physical-key check remains the final acceptance gate for browser-chrome interception on the target installation.

### Remaining review gates

- In current Chromium on the target display, select Protect Ctrl+W/S, grant fullscreen/keyboard-lock permission, verify repeated physical Ctrl+W/S height movement, then hold Escape and confirm ordinary browser shortcut behavior returns.
- Compare current Firefox and Safari. Browsers without the Keyboard Lock API retain Page Up/Page Down but cannot promise Ctrl+W interception from webpage code.

## Stage 18 — non-zero Flat groundstroke calibration

- **Status:** Implemented locally on 2026-08-31; owner/coach range review remains open
- Reclassified the Groundstroke `Flat` option as `Flat drive`: a lower-topspin trajectory family rather than a spin-free ball. The shared profile defaults to 760 rpm and exposes 250–1,600 rpm, while ordinary Topspin remains a separate higher-spin choice.
- Applied the same calibration at all target-practice boundaries: selecting Flat drive resets the control to 760 rpm, persisted legacy zero-spin preferences migrate to 250 rpm, compiled sessions normalize stale zero values, and the flight integrator clamps direct Flat-groundstroke input to the same positive range.
- Kept Volley as the only deliberately spin-free Quick Practice family. Serve and Lob retain their existing family-specific behavior.

### Evidence and verification

- Protheroe measured nominally flat forehands at about 761 rpm and flat backhands at about 473 rpm; a separate junior-match sensor study reported flat groundstrokes around 1,000 rpm. The 760 rpm default follows the controlled forehand mean, while the broader control range remains an explicit product calibration rather than a universal population claim.
- Implementation commit: `7d3618c`.
- Focused trajectory, session, and storage run: 3 files, 73 tests passed. New coverage proves the default 760 rpm, 250 rpm lower bound, positive Magnus spin parameter, session normalization, and legacy preference migration.
- Full `npm test -- --run`: 12 files, 120 tests passed. `npm run build`: production TypeScript/Vite/PWA build passed; the existing large-scene-chunk warning remains.
- Chrome at 1280 × 720 and 767 × 898 selected `Flat drive`, displayed 760 rpm with a 250–1,600 slider range, retained zero horizontal overflow, and reported no console errors.

### Remaining review gates

- Coach/player review of whether the 250–1,600 rpm Flat-drive envelope and 760 rpm default feel appropriate across recreational forehand and backhand feeds.
- Instrumented trajectory comparison before describing the profile as player-measured rather than research-calibrated.

## Stage 19 — reference-aligned Rally ball defaults

- **Status:** Implemented and browser-verified on 2026-08-31
- Updated the clean application and Rally quick-practice preset to Trajectory On, Groundstroke, 70 km/h launch speed, Topspin at 1,103 rpm, 8.50 m landing depth, and a 3.50 s interval.
- Centralized the 1,103 rpm groundstroke-topspin fallback so the practice profile and direct physics intent resolve the same default. Explicitly saved user settings remain untouched until the user selects Rally again.
- Implementation commit: `2991612`.

### Verification

- Focused storage, practice-preset, and trajectory run: 3 files, 44 tests passed. Full `npm test -- --run`: 12 files, 122 tests passed.
- `npm run build`: production TypeScript/Vite/PWA build passed; the existing large-scene-chunk warning remains.
- In-app Browser at 1280 × 720 selected Rally and rendered the six requested values exactly. The live court reported WebGL 2 at 238 fps, used the 3.5-second setup cadence, and produced no browser warnings or errors.


## Opponent movement revision 9 — 2026-09-06

Implemented locally: 23-clip athletic motion library, lower running recovery, distance-driven stepping, front/back crossovers, jumping and slide variants. A shared planner now reserves recovery toward a handed baseline-center bias, a split-step and a separate next-shot approach. Final-shot and net-position recovery are included. Existing stroke poses/contact anchors are preserved.

Validation: 218 frontend tests (22 files), production/PWA build, 23-clip anatomical/choreography/export gates, 11 mixed gameplay events per hand and 19 movement variants per hand at 240 Hz. Browser review covers all variants and the 13-shot recovery demo. Owner visual acceptance remains open. See [local motion pipeline](local-motion-pipeline.md) for the active asset and review controls.

## Articulated opponent mannequin — 2026-09-06

Replaced the rejected semi-realistic candidate with the CC0 Quaternius articulated mannequin, displayed at 1.88 m. The source binder, hashes and license are recorded in `docs/assets/quaternius-articulated-mannequin.md`. All 23 reviewed clips and their timing/metadata remain exactly unchanged. Gameplay preserves the visible joint colors and now blends serve ground support continuously through landing.

Verified locally: 221 frontend tests / 22 files, 20 lab JavaScript tests, four Python rhythm tests, anatomy/choreography/export/gameplay gates and production build pass. Browser review covers both full 13-shot sequences and the 19 movement variants with no joint warnings. See the lab's `docs/evidence/character-replacement.json`. Owner visual acceptance remains pending.
