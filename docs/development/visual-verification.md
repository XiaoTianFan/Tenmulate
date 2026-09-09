# Visual verification ledger

- **Purpose:** Record concept-to-browser inspection after every implementation stage
- **Reference viewport:** 1920 × 1080 unless stated otherwise

## Shared minimalist scrollbars — 2026-09-09

Production Edge at 1680×1000 and 390×844 shows 8 px scrollbar tracks with 4 px
rounded thumbs, muted at rest, brighter on hover and yellow while dragged.
Overflow-free axes show no bar. Practice/editor inspectors, the shot library,
timeline, drill table and About dialog share the style. The narrow drill table
keeps both overflow axes inside its wrapper. Desktop and narrow screenshots were
visually inspected, including the active horizontal thumb and the dialog's
vertical thumb. Touch emulation uses a 12 px target and preserves swipe scrolling;
Windows forced-color emulation retains visible system-color thumbs.

`npm run build` passes, including TypeScript and the active motion/cache guard.
Browser assertions pass for native wheel and thumb input, Tab-driven focus
scrolling, mobile containment, both-axis drill-table scrolling and an unchanged
scene instance across route changes. No page errors or framework overlay occurred.
This CSS-only change adds no runtime scroll handlers or renderer work; physics and
motion tests were not repeated. Firefox's standard-property fallback is implemented
but was not separately browser-tested.

Evidence: `C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/scrollbars/`
contains `scrollbar-qa.mjs`, `results.json`, and the practice/editor, active timeline,
mobile table/dialog, touch and high-contrast screenshots. The isolated Edge launch
removes Playwright's default `--hide-scrollbars` argument so these checks exercise
visible native scrollbars. The owner's existing editor tab was not reloaded.

## Independent incoming and return shot controls — 2026-09-09

The [return shot receipt](return-shot-controls-2026-09-09.md) records production
Edge at 1680×1080 and 390×844. Opponent shot and Return zone controls are separate
from Ball & rhythm. Changing shot/spin and dragging the return zone preserve the
other ball's configuration. Preset overwrite and reload/reuse pass; kick/sidespin
appear only for serves in both editor and Quick Practice. No horizontal overflow,
framework overlay or browser runtime errors were observed. Actual Three.js checks
cover 54 both-hand approach/swing/contact samples across return styles and the
opponent's drop/volley/overhead strokes; the physical handoffs and rendered racket
contacts agree. Representative screenshots were inspected. The owner's existing
editor was preserved without reload.

## Court-space return zones and shot-library editor — 2026-09-09

The [editor/return receipt](editor-return-zones-2026-09-09.md) supersedes the
camera-relative return footprint in the next entry. Production Edge verifies the
filtered shot library, native timeline insertion/reordering, removal/Undo, WASD,
both court-zone moves/resizes and saved-shot overwrite through reload. Desktop,
centered top-down and 390 px mobile layouts were inspected. Held camera/zone
gestures do not recompile the session; Test drill retains the renderer instance.
Actual rendered approach/swing/contact frames were reviewed for both hands at two
successive physical return intercepts. Racket contact and non-root bone-length
errors remain below 0.000001 m. The owner's existing editor tab was not reloaded,
preserving any unsaved work. These are local implementation/verification results.

## Drill camera, return space and reusable shots — 2026-09-08

The [camera/editor receipt](drill-camera-and-editor-2026-09-08.md) records the 1600 ×
1000 production editor, 390 px phone layout and actual player-camera transition
frames. The blue return footprint is distinct from the yellow landing zone and
fully visible in the overview. Camera drags perform no session updates while held
and one on release. Complete shot presets survive reload and remain independent
after insertion. A 23-second production recording contains 1,646 rendered view
samples; maximum adjacent movement is 4.16 cm and peak travel is 2.49 m/s in that
sequence. This bounded recording is not target-device thermal qualification.

## Prepared stroke entry after movement — 2026-09-08

The [prepared-entry receipt](prepared-stroke-entry-2026-09-08.md) records six lab
entry views and 24 actual-renderer sequences: both hands in practice/drills for
drives, slices and volleys. Frame review follows braking, arrival, held preparation,
strike entry and contact. Four ordinary-playback runs cover both modes and hands.
The opponent retains its prepared pose through arrival and continues the swing
without a ready reset. The source reference labels and original complete clips
remain available. The existing user preview is refreshed with saved settings intact.
Anatomical/continuity gates pass; owner technique acceptance remains separate.

## Shared court, zone resizing and camera presets — 2026-09-08

The [shared-court receipt](shared-court-and-zone-resize-2026-09-08.md) records the current interaction and renderer lifetime under implementation `32aabe2`. Actual production Chrome confirms interior movement, anchored edge/corner resizing, one commit on release, cancellation, editor Undo/Redo/save and touch access. Practice/Editor/drill playback reuse one canvas and WebGL context, with one venue/opponent load; the library stops issuing draw calls. Left/right corner and centered volley images were compared with the user's three supplied references and their look targets verified numerically. The two annotated explanations are removed and **Shot Variation** is visible. The 1440×1000 desktop, 685×898 narrow and 390×844 touch layouts were inspected; narrow hint/status bounds do not overlap. The owner's existing in-app tab is refreshed. Local measurements establish reduced drag stalls and resource reuse, without claiming device-temperature or owner acceptance.

## Earlier direct landing-zone dragging — 2026-09-08

The [direct-drag receipt](landing-zone-direct-drag-2026-09-08.md) supersedes the arrow interaction below. The area highlights on hover and accepts off-center left drags in both court coordinates. Camera and zone gestures retain their initial ownership across boundary crossings. Practice presets, keyboard access, persistence, saved editor placement and mobile touch pass in production Chrome. Final checks at 1440×1000, 886×883 and 390×844 verify visible geometry without center/arrow handles, no horizontal overflow and no hint/status overlap. The owner's in-app tab is refreshed; owner acceptance and physical-device qualification remain separate.

## Scene landing zones and continuous preview — 2026-09-08

The [current zone receipt](landing-zone-verification-2026-09-08.md) supersedes the CSS first-bounce handles in the next historical entry. Production Chrome at 1440×1000 and 390×844 shows Three.js zone geometry, red X/blue Z arrows and a white actual-bounce ring. Baseline/oblique drags and keyboard movement preserve the unused coordinate and camera. Raised editor framing keeps edge zones visible; saved dimensions and parameter variation survive persistence. No horizontal overflow or application errors were observed. A 55.41-second development-browser run crossed two fresh-batch boundaries despite a one-repetition set and 120-second rest setting. The user's existing in-app production tab was refreshed and the new controls verified.

## Independent practice controls and first-bounce editing — 2026-09-08

Production preview at `http://127.0.0.1:5173/` was checked in Chrome at 1440×1000,
767×898 and 390×844. Actual gameplay loaded the 25-clip bundle and authored venue.
The active [refinement receipt](practice-refinement-2026-09-08.md) supersedes the
coupled-clock UI described in the next historical entry.

- First-bounce hover exposes visible yellow direction/depth arrows on dark
  backgrounds. Drag, click and keyboard interaction preserve the other target
  coordinate and leave camera position/look unchanged. Return editing selects a
  custom legal service-box target; reload preserves it and the pattern can be restored.
- Groundstroke/volley/overhead side selection changes the loaded motion. Both-hand
  backhand overhead was inspected in setup and actual rehearsal. Forehand overhead
  remains the documented no-toss serve proxy.
- Practice 150%/12 s/60%, drill 70%/14 s/150%, and saved editor 145%/13 s/135%
  demonstrate independent stroke, interval and movement inputs. Editor preview
  retains drill-authored positions. A full production browser flow verified saves,
  playback and responsive layout with no application errors or horizontal overflow.
- MotionLab front/side preparation, contact and follow-through were inspected.
  Actual gameplay walk/run push, cruise and brake poses were reviewed for both
  hands, including normal-speed playback and 63-joint post-IK checks.
- The supplied 70 km/h / 1,103 rpm screenshots motivated the trajectory fix.
  The low-angle branch and natural adjustment remove the prior branch jumps;
  the heading sweep and infeasible request are covered by physics tests.

Evidence lives under
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/`:
`return-hover-handles.png`, `production-overhead-right.png`,
`production-practice-overhead.png`, `production-editor-independent-clocks.png`,
`production-mobile-390.png` and `motion-run-right-{push,cruise,brake}.png`, with JSON
receipts named in the refinement record. A Chrome shader precision warning is
recorded separately from application errors. Owner technique and device acceptance
remain separate from this implementation review.

## Gameplay rhythm integration — 2026-09-08

The goal's visible comparison was: fixed-home practice, direct fast drill travel,
percentage rhythm controls and an incoming → return → next racket ball handoff.
The existing Playwright runtime drove Chrome because the Browser skill was not
available. Development and production preview (`http://127.0.0.1:5173/`) were
inspected at 1440 × 1000 and 767 × 898.

- Setup: 150% rhythm changes the derived contact interval; the loaded opponent
  moves through existing gait clips. Return → Compact appears in setup and actual
  rehearsal. Overhead is available as a shot type, using the documented proxy.
- Rehearsal: pause/next works; fast Corner switch runs between its explicit
  sideline origins. A production return-flight frame shows the ball returning
  while the opponent approaches the next stroke. Camera-intensity changes restart
  and recompile the session as labeled.
- Editor/library: percentage rhythm can be set, saved locally and used to run a
  drill. Desktop and mobile screenshots show controls without horizontal overflow.
- Mismatch found and fixed: early return solutions used excessively high arcs to
  occupy a full recovery gap. ADR-0016 changes the natural drill baseline and
  bounds return apex; fixed-speed drill resolution also removes hidden pace growth.
- No application console errors. The existing GPU shader precision warning and
  large renderer build chunk remain. Automated FPS does not establish device
  acceptance. Full measurements and external screenshot paths are in the
  [integration receipt](gameplay-rhythm-integration-2026-09-08.md).

## Stage 18: six Blender venues, Performance and seated audiences — 2026-09-05

The owner requested three fully authored indoor halls, retirement of procedural
venue sketches, real lower-detail assets for all six venues, and efficient
Empty/Half/Full spectators. The frontend-testing skill drove the venue → quality
→ occupancy flow and negative-path checks; React guidance kept startup selection
ahead of asset loading and animation work outside React. Browser plugin/skill was
unavailable, so Playwright CLI provided actual Chromium inspection. Built-in
image generation produced the front/back audience atlases; prompts, rejected
transparency trials and accepted chroma-key source are in `assets/audience`.

Environment: production preview `127.0.0.1:4174`, Three.js r185 / WebGL 2,
1440 × 900 desktop and 390 × 844 mobile. Evidence is local-only under
`C:/Users/20378/.codex/visualizations/2026/09/05/six-blender-venues/`.

| Check | Evidence / result | Boundary |
| --- | --- | --- |
| App/venue identity | All six production titles, IDs, `ready`, Blender source and chosen variants match; main setup defaults to authored content | No opt-in or procedural substitute remains |
| Meaningful content | Inspected timber pitched hall, clay trusses, grass barrel vault, textured courts, equipment, seating and audience; outdoor Quality geometry preserved | Original indoor architecture, not surveyed buildings; 2D crowd is thin edge-on |
| Overlays | Zero framework overlays in the six-venue production matrix; temporary loading overlay clears | Forced failures intentionally show an error |
| Console/runtime | Zero page/console errors in healthy six-venue runs; 503 tests produce expected failed requests | Cold Intel ANGLE precision notices and build-time Blender device probes are not new application failures |
| Screenshots | Final indoor player/sideline, outdoor full crowds, mobile Half and main preference UI captured and visually inspected | Owner visual approval remains open; no claim of photorealism or target-device certification |
| Interaction | All six Performance → Full → Half → Empty flows; final exact counts 560/896/672/13,304/13,664/14,381; Half is floor(count/2) | Artwork has resting/raised-arm poses and subtle shader sway, not skeletal waving |

Additional boundary checks:

- Performance startup requested only its selected GLB; Empty fetched no seat JSON
  or artwork. Full and Half reuse the same active atlas. Mobile Auto fetched only
  the grass Performance GLB plus 512 px atlases, rendered 7,190 spectators, and
  had `scrollWidth = innerWidth = 390`. Desktop Auto stepped down to the clay
  Performance asset after sustained slow windows.
- Rapid venue/quality switching never reattached stale models. Three complete
  timber → clay → grass hall cycles returned to the same 16-texture count and
  560 spectators; Empty removed the two atlas textures. Unit tests additionally
  assert bitmap, geometry, material and late-decode disposal.
- Forced GLB 503 showed the correct unavailable message and visible Retry,
  then restored the same selected Performance venue. Forced audience 503 kept
  the correct clay hall, exposed an operable Retry audience button, then restored
  all 896 people. The first error-banner trial inherited `pointer-events:none`;
  it was corrected and rechecked, not counted as acceptance.
- Main setup persisted `clay-stadium` / Half / Performance, reloaded with 448
  spectators, and showed the unchanged room-safety gate on Start practice.
  Continue remained disabled; Cancel returned to setup. This task did not attest
  to physical room clearance or bypass the gate. Code passes the same environment
  and quality into rehearsal; the separate motion task owns its practice checks.
- A controlled service-worker warm load followed by offline reload restored the
  final timber Quality hash and 280 spectators. This is one representative cached
  venue/audience proof, not a promise that unvisited venues work offline.

Verification: **179 tests / 21 files**, production build, twelve decoded GLB
hash/registration/triangle/seat-budget checks pass. All twelve raw Khronos glTF
validations report zero errors/warnings. Timber n-gon caps were triangulated to
remove the initial explicit-tangent portability warning. The existing minified
renderer chunk warning remains (~637 kB). No remote deployment was performed.

Measured model reduction is 81–89% of triangles and 54–84% of bytes; exact budgets
are in [the build/runtime record](indoor-venues-and-performance.md). Performance
full crowds add four visible indoor batches and roughly twenty in large arenas.
One warm development pass sampled 116–120 fps indoors and 44–50 fps outdoors in
Performance. Production captures during loading/multiple browser contexts were
much lower (10–40 fps); these are deliberately not comparable benchmarks.
Detailed outdoor Quality remains expensive. Controlled GPU/device profiling,
extended endurance and owner art approval remain separate gates.

Final gallery: `final-timber-hall-half.png`, `final-covered-grass-arena-quality.png`,
`final-clay-hall-sideline.png`, `final-{grass-center-court,clay-sunset-arena,hard-open-arena}-quality.png`,
`final-mobile-half.png`, `final-practice-controls.png`, `final-load-error.png`,
`final-audience-error.png`. Reproducible QA scripts are kept beside the captures.

## Stage 1: setup plus first Three.js court

| Comparison point | Concept evidence | Browser evidence | Result / action |
| --- | --- | --- | --- |
| Information architecture | Three rails: session, dominant preview, setup inspector | Same three rails at 1920 × 1080 | Matched structurally. |
| Palette and container model | True charcoal, blue selected row, yellow rule/action, open dividers | Same tokens and open rails; no card-grid substitution | Matched. |
| Typography and density | TV-readable compact instrument chrome | Hierarchy matches; several labels are smaller/lighter than the concept | Retain as a final fidelity correction. |
| Court camera | Centered player view with horizontal-FOV control | Initial render exposed vertical-FOV semantics; corrected to 70° horizontal | Fixed before commit. |
| Regulation net | Visible center sag and higher posts | Initial tape was flat; replaced with a sampled sagging tape | Fixed before commit. |
| Court/environment treatment | Game-realistic Panel 1 asset target | Exact procedural court plus visibly low-poly context | Intentional temporary deviation authorized by the ball-machine/asset-substitution plan. |
| Controls | Five view presets and setup inputs | All five view presets, pause/restart, pace/spin/surface and calibration sliders change live state | Core path verified; non-stage routes remain pending. |
| Ball readability | Yellow ball is the primary moving focal point | Enlarged presentation ball, yellow trajectory, visible shadow and diagnostic landing | Pass for prototype; trail/halo toggle remains pending. |
| Console/runtime | No error state in concept | Zero console errors and warnings after favicon/shadow-map corrections | Pass. |

The reference image and final browser screenshot were both inspected directly with `view_image`. The initial and interaction screenshots are temporary QA artifacts under ignored `output/playwright/`; they are not product assets.

## Stage 2: active rehearsal and learning state

| Comparison point | Concept evidence | Browser evidence | Result / action |
| --- | --- | --- | --- |
| Full-bleed hierarchy | Court fills the screen below a 58 px rail | Live Three.js canvas fills the viewport with overlay chrome | Matched. |
| Header anatomy | Wordmark, drill, repetition, Settings/Full screen/Exit | Same hierarchy and functional actions | Matched. |
| Quiet rehearsal | Minimal corner mode/readout and centered transport | Same three-island control composition; predictive cue hidden in rehearsal | Matched with intentional product-principle correction. |
| Learning mode | Direction cue and timing line | Direction cue, timing line, and exact trajectory are visible only in Learning | Pass. |
| Ball focus | Ball is the scene focal point | Animated enlarged ball is visible during flight; no persistent setup reticle remains | Fixed and passed. |
| Transport | Previous, pause, restart, next, speed, progress | All controls are code-native and update session state | Pass. |
| Shot readout | Pace, spin, depth/direction, sound | Resolved launch pace, compiled spin/direction/depth, mute control | Pass. |
| Safety/completion | Not shown in primary concept but required by PRD | Focused modal system in the same palette; singular/plural completion copy verified | Pass. |
| Asset fidelity | Game-realistic court/opponent target | Low-poly procedural venue plus ball machine | Intentional temporary deviation; no raster screenshot used as UI or scene. |
| Runtime | No visible failure state | Content advanced across deterministic repetitions; zero console errors/warnings | Pass. |

Both the 1920 × 1080 reference and final rehearsal browser screenshot were inspected directly with `view_image`. The setup reticle leak and pause-reset defect found during intermediate inspection were corrected before the stage commit.

## Stage 3: drill library and timeline editor

| Comparison point | Concept evidence | Browser evidence | Result / action |
| --- | --- | --- | --- |
| Editor composition | Event rail, dominant court, property rail, timeline below | Same three-column/five-track hierarchy at 1920 × 1080 | Matched structurally. |
| Live scene | Approved Panel 1 court with selected trajectory | Same functional Three.js scene/trajectory as rehearsal | Pass; procedural art remains the authorized substitute. |
| Timeline semantics | Opponent, ball, camera, cue, rest | All five code-native tracks derive from versioned event data | Pass. |
| Event editing | Add/search, reorder, per-event parameters | Add-select, drag reorder, duplicate/delete, shot/pace/spin/target/camera/cue controls | Pass; search is replaced by a compact native shot selector. |
| History and validation | Undo/redo, saved state, validation footer | 50-step undo/redo, always-visible valid/error state, detailed issue list | Pass. |
| Local data | Import/export and test action in top rail | Import/export grouped in inspector; save/test remain persistent actions | Intentional placement change preserves the court width. |
| Library | Not shown as a separate concept | Open three-column table with bundled/custom provenance and run/edit/export/delete actions | Product-consistent extension. |
| Offline | Required status, not visualized in editor concept | Generated service worker reloaded at 1280 × 820 with network disabled | Pass. |
| Runtime | No visible failure state | Edit/save/navigation loop completed with zero errors/warnings | Pass. |

The editor concept and final browser screenshot were inspected directly with `view_image`. Compared with the concept, the implemented editor prioritizes a denser event list and full primitive-level controls while retaining the approved hierarchy, palette, court dominance, and five-track model.

## Stage 4: venue and training-runtime expansion

| Comparison point | Intended behavior | Browser evidence | Result / action |
| --- | --- | --- | --- |
| Venue combinations | Outdoor, club hall, stadium × hard, clay, grass | Outdoor/hard baseline plus club-hall/grass and stadium/clay screenshots at 1920 × 1080 | Functional pass; production art remains external. |
| Venue context | Seating, umpire chair, rest bench, perimeter/architecture | Every shell retains the code-owned court props and adds shell-specific seating/walls/context | Pass at procedural placeholder fidelity. |
| Lighting | Outdoor day/golden/night and indoor neutral/warm/bright | Mode options change with venue; direction/intensity update scene lights/background/fog | Pass. |
| Court authority | Visual settings must not alter replay | Venue/environment lives on `SessionLaunch`; compiler accepts only surface physics | Architectural pass. |
| Work/rest | Clear active/rest transitions | Large central rest countdown, set numbering, frozen scene, and automatic resume | Pass. |
| Settings density | Quiet rehearsal plus discoverable comfort/audio controls | Settings panel contains camera-motion scaling, four audio channels, and diagnostics | Pass; hidden until requested. |
| Readability | Ball/court remain primary in every shell | Ball remains bright and central; indoor placeholder walls are deliberately spare | Pass for functional shell; revisit during canonical Three.js scene refinement. |

The club-hall/grass and stadium/clay browser screenshots were inspected directly with `view_image`. The large simple wall/roof fields are recognized as placeholder art rather than a target visual finish.

## Stage 5: calibration, responsiveness, and final rehearsal instrumentation

| Comparison point | Intended behavior | Browser evidence | Result / action |
| --- | --- | --- | --- |
| Physical calibration | Real display measurements produce a usable physical view | 120 × 67.5 cm at 250 cm reported 27° horizontal / 15° vertical and applied 27° without clamping | Pass; corrected the earlier 45° lower-bound mismatch. |
| Surface coherence | One selector drives both material and bounce profile | Selecting Clay left one visible Surface control and changed the rendered court to clay; storage tests preserved one canonical surface value | Pass; legacy independent values migrate with the former physics choice taking precedence. |
| Camera coverage | Baseline, transition, net, and overhead views | Eight presets and six continuous camera axes are present; reset restores the documented realistic view | Pass. |
| Rehearsal instrumentation | Quiet primary view with optional detailed diagnostics | Settings panel shows five audio channels, ball options, net clearance, pre/post-bounce speed, arrival, and renderer metrics | Pass. |
| Ball accessibility | Visibility help cannot alter the physical path | High-contrast scale/material and ten-sample trail are renderer-only settings | Architectural and interaction pass. |
| Responsive setup | Compact devices configure safely without pretending to be ideal practice displays | 1280 × 820 remained usable; 820 × 1000 stacked cleanly with no horizontal overflow and showed the large-display recommendation | Pass. |
| Performance behavior | 60 fps target with adaptive quality, no unearned high-refresh claim | Auto/performance/quality controls report actual pixel ratio; 90/120 option remains hidden | Pass for local browser; reference-device profiling remains external. |
| Runtime health | No console or renderer error in the final interaction path | 1920 × 1080 setup and live rest/diagnostic state showed zero console errors/warnings | Pass. |

The final setup and rehearsal screenshots were inspected directly with `view_image`. The procedural opponent and venue are explicitly functional stand-ins and were not judged as production-asset fidelity.

## Stage 6: canonical scene composition — first pass

| Comparison point | Accepted Panel 1 / pivot target | Browser evidence | Result / next action |
| --- | --- | --- | --- |
| Spatial authority | Every visible venue element is editable Three.js geometry around the exact court | Six typed code-owned scene groups; no environment mesh, panorama, splat, iframe, or remote texture | Pass. |
| Court material scale | Fine blue acrylic with matte green runoff | Deterministic repeating acrylic/runoff maps show fine grain and remain dynamically relightable | Strong first pass; reduce visible repetition during polish. |
| Enclosure | Dark framed chain link with far-court windscreen | Cross-hatched line enclosure, posts/rails, and deep-green far windscreen | Pass structurally; soften the fence's screen-space dominance. |
| Seating and furniture | Long low blue stands, two shaded benches, umpire chair | Individual instanced blue chairs on stepped concrete plus two shelters and a roofed umpire chair | Pass structurally; side seating remains too large/close compared with the reference. |
| Far-court anchor | Centered clubhouse, veranda/steps, glazing, planters, hedges | Code-built facade, glazing bays, columns, roof, terraces, planters, hedge bands | Clear hierarchy match; add facade/landscape depth and roof detail. |
| Landscape and light | Layered hedges/trees, four slim light poles, crisp daylight shadows | Multi-cluster trees, hedge bands, four modeled poles/arrays, directional shadows | Improved from blob trees; crown silhouettes and sky still read stylized. |
| Remaining scenes | Five distinct court/environment identities | Clay terrace, grass park night, timber hall, clay stadium, and covered grass arena all render and select with their target surface/lighting family | Functional composition scaffolds only; each needs its own fidelity pass. |
| Runtime health | No visible error and no leaked scene resources | Six-scene switch loop completed at 1920 × 1080 with zero console errors; disposal deduplicates geometry, materials, and textures | Pass for correctness. Headed-browser FPS was invalid because the OS throttled the occluded window; foreground profiling remains open. |

The accepted player-level reference and all six browser outputs were inspected directly with `view_image`. Four subsequent Panel 1 comparisons corrected clubhouse elevation/roof orientation, net and fence contrast, court/runoff albedo and micro-normal scale, seating/rail proportions, sky treatment, and foliage silhouettes. The final realistic and wide player renders are now compositionally credible game-realistic views rather than the prior flat shell. Photoreal vegetation micro-detail, architectural weathering, and valid foreground performance evidence remain later refinement gates.

## Stage 6: remaining five scenes — authored first pass

| Scene | Reference-defining section | Final browser evidence | Result / remaining refinement |
| --- | --- | --- | --- |
| Mediterranean clay terrace | Sunken clay deck, pale stepped stone, hedges/cypress, stairs, arched villa | Full clay deck framed by six-level terraces and a centered four-arch terracotta-roof villa | Identity and depth pass; later add stone weathering, planted pots, and distant terrain. |
| Grass park at night | Bright grass rectangle inside a dark landscaped amphitheater | Striped full grass deck, three-sided individual green seats, tree/hedge perimeter, four light arrays | Lighting balance pass after dark and clipped intermediate renders; later add localized spotlight falloff and aisle detail. |
| Timber and steel hall | Warm repeated timber arches, pale roof/skylights, glass, blue seating | Repeated portal frames and pitched panels form a clear hall section above two individual-seat stands | Strong section match; later add timber joinery, acoustic panels, and skylight daylight variation. |
| Indoor clay stadium | Dark tournament bowl, warm seats, trusses, portals, bright clay court | Three-sided individual warm seating, media box, portal/concourse elements, roof grid, full clay deck | Bowl identity pass; later add aisles, vomitories, scoreboard content, and broadcast detail. |
| Covered grass arena | Pale covered roof, green bowl, glazed landscape end wall | Three-sided individual green seating, pale structure, framed glazing, and trees beyond the glass | Identity and lighting pass; later add roof services, glazing reflections, and aisle/railing detail. |

Every scene was selected with its intended appearance and lighting family at 1920 × 1080, captured, and inspected directly with `view_image`. The same exact court/net/ball layer remained in place during every switch. The headed Playwright window remained background-throttled, so the screenshots and zero-error console are valid while its FPS readout is not accepted as performance evidence.

## Stage 6: neutral opponent carrier — first pass

| Comparison point | Target | Browser evidence | Result / remaining gate |
| --- | --- | --- | --- |
| Rights and payload | Rights-cleared low-detail runtime asset | CC0 source/license recorded; texture-free GLB is 741,412 bytes with an immutable SHA-256 | Pass. |
| On-court scale | Credible adult opponent at the far baseline | Loader normalizes the rig to 1.84 m and places it 0.95 m behind the far baseline | Pass from realistic, approach, and volley cameras. |
| Presentation | Neutral faceless silhouette; no identity work | Separate eye/eyebrow nodes and all textures are absent from the active scene; one matte navy material remains | Pass at gameplay distance; not approved for close-up use. |
| Rest silhouette | Never expose the source T-pose | Anatomical-axis bone correction lowers/bends both arms into a compact ready stance | Pass as a non-animated fallback pose. |
| Mocap compatibility | Stable humanoid mapping plus detachable racket sockets | 23-role adapter validates the 65-joint skin; `hand_l` and `hand_r` are exposed; lazy animation GLBs and clip cross-fades are implemented | Runtime seam passes; actual tennis clips and racket are pending. |
| Failure behavior | A missing/invalid asset must not break practice | Opponent stays hidden until validation succeeds; ball machine remains visible on load/skeleton failure | Pass. |
| Runtime health | No new visible or console failure | Fresh load and three camera inspections completed without new runtime warnings/errors; full build and 56 tests pass; production precache includes the GLB/license/manifest | Correctness/offline-manifest pass; target-device animation performance remains open. |

The first browser render exposed the raw T-pose, which was rejected immediately. The second pass used the actual shoulder/arm bone positions to derive a neutral ready stance and was accepted for the unanimated carrier. No mocap, racket attachment, or contact synchronization is claimed by this visual pass.

## Stage 7: owner-reference arenas, atmosphere, weather, and indoor correction

| Comparison point | Owner reference / requirement | Browser evidence | Result / remaining refinement |
| --- | --- | --- | --- |
| Blue hard arena | Rounded open roof, blue multi-level seating, dark lower ring, tournament-scale enclosure | A continuous three-tier rounded-oval bowl, blue/dark seat zoning, steep upper deck, modeled concourses, dark procedural roof underside, generic score display, and roof-line fixtures frame the court | Reference-calibrated procedural pass. The instantiated seat count is capacity-bounded with the other arenas; roof services and architectural microdetail remain an authored-asset gate. |
| Sunset clay bowl | Squarish rounded clay arena, green/tan tiers, asymmetric upper mass, dusk sky | Rounded-rectangle lower/middle seating plus unequal partial upper arcs, tan/green/dark zoning, raised side/far canopies, and restrained golden-hour scattering establish a different section from the other bowls | Reference-calibrated procedural pass. The asymmetry and roof silhouette are present; skyline, terrain, and fine concourse detail remain later authored work. |
| Grass center court | Continuous green bowl, rounded-square plan, green roof identity, open daylight | A two-tier rounded-square bowl uses a broad continuous upper rake, green seats and procedural green roof ring around a central sky aperture | Reference-calibrated procedural pass. Palette, section, and continuous form are distinct; broadcast-grade retractable-roof mechanics remain later asset work. |
| Original outdoor scenes | Full surrounding environment, not scattered trees | Club adds path network/buildings/planting perimeter; clay extends terracing/villa/landscape; grass park adds paths, hedges, pavilion, dense tree belt | Context contract passes; owner composition review remains. |
| Dynamic atmosphere | Sky must drive light/time and react to weather without a blank gradient or blown solar bubble | One Three.js `Sky` shader now owns atmospheric scattering and animated multi-octave cloud uniforms; solar directional light, hemispheric fill, fog, PMREM environment, weather, and exposure update from the same time/sky state | Visual pass. Noon retains visible cloud texture, while reduced clear-sky Mie scattering and sun-disc energy remove the former oversized white bloom. |
| Outdoor artificial light | All six outdoor venues need modeled dawn/night court light | The three original venues have four pole arrays and every arena has roof/upper-concourse fixtures; their local spotlights use solar elevation to fade on below the horizon/twilight threshold | Day/night browser comparison passes; fixture placement and court illumination are visible, with target-device photometric calibration still open. |
| Court and net contact | Court/runoff/lines must not float; net must read densely with a broad white band | Runoff is a coplanar ring around a 4 cm inset slab whose top is exactly y=0; 1.5 mm line meshes start at y=0; the net has 64 verticals, 24 horizontal rows, a 7.5 cm shader-preserving tape, and a center strap | Geometry tests and the approach-camera inspection pass. |
| Weather and wind | Visible rain plus physical configurable wind | Shader rain is legible over the clay arena; unit evidence verifies wind moves bounce and replays exactly; live controls appear in setup | Pass for visual/weather and solver seam; real wind/trajectory calibration remains. |
| Indoor halls | No seating, aligned lamps, upright semicircle grass roof | All three halls have no bleacher groups; fixture lenses and spotlights share transforms; wall ribs, acoustic panels, doors/services add scale; the grass hall has a suspended-light upright barrel arch and paneled semicircular end cap | Corrected and visually passed. Materials remain procedural and intentionally lower detail than the arena references. |
| Procedural texture rule | Essentially every venue surface uses custom shaders | Empty texture bundle; GLSL pattern families visibly distinguish acrylic/clay/grass, seats, concrete, metal, timber, foliage, roof, and ad boards | Architectural pass and credible first visual pass; reduce large-field procedural repetition in later polish. |
| Runtime health | Switching and atmosphere updates must not leak or error | Outdoor club, three arenas, night lighting, and the close court/net view switched in the in-app browser; rounded-tier shape/capacity, all-six floodlights, layer contact, and net density are unit-tested; 64 tests and production build pass; zero console errors or warnings in the final loop | Correctness pass. Reference-device profiling and owner visual approval remain open. |

The three owner-supplied photographs were used only for massing, palette, venue hierarchy, and lighting calibration. Identifiable logos, sponsor art, and venue-specific trade dress were deliberately excluded. The references and five final player-view captures were inspected together with `view_image`; temporary evidence lives outside the repository and is not a shipped asset. The remaining mismatch ledger is deliberate and visible: continuous procedural superellipse bowls approximate rather than duplicate the venues, roof mechanics are simplified, empty seats omit audience clutter, and large surfaces still lack the microgeometry/weathering expected from a final Blender-authored or scanned stadium package.

## Stage 8: shot-aware Quick Practice and movement reliability

| Comparison point | Intended behavior | Browser evidence | Result / remaining refinement |
| --- | --- | --- | --- |
| Shot taxonomy | Ball controls expose only physically compatible choices | Groundstroke offers Flat/Topspin/Slice, Serve offers Flat/Slice/Kick, and Volley shows one disabled None value; the former Preset option is absent | Pass. Specialist authored drills may retain validated sidespin independently of Quick Practice. |
| Serve legality | A serve begins above the player and lands diagonally inside the service box | Return selected a 2.75 m Serve profile; Flat landed at `-0.12, -5.09 m` and Kick at `-0.12, -4.04 m`, both clearing the net | Functional/legal pass. Contact height, default pace, and measured curve remain coach/instrument calibration gates. |
| Volley identity | Separate the user's Volley practice setup from an explicitly authored opponent volley | The Volley rail preset selects the `At the net` camera while keeping the opponent at `0.0, 12.9 m` and selecting a Groundstroke/Topspin feed. Choosing Volley in Shot type remains the spin-free opponent-volley profile at `0.0, 3.7 m` | Corrected and passed. Opponent animation/contact-pose fidelity remains dependent on production mocap. |
| Bounce control | Perceptual adjustment is explicit and cannot rewrite incoming flight | Ball arrival exposes 0.60×–1.40×; automated evidence keeps launch velocity identical and orders post-bounce apex low < natural < high | Architectural/test pass. Browser range-drag automation was not accepted as evidence; owner feel review remains. |
| Surface response | Surface changes rebound through physical contact parameters | Automated rebound samples show higher-friction clay losing more horizontal speed and rebounding higher than grass under the same incoming shot | Research-calibrated pass; measured court fitting remains external. |
| WASD continuity | Held movement works after ordinary controls retain focus | Pressing A while Shot type remained focused cleared the active Baseline preset without changing the selected Volley profile; diagonal/time-step behavior is unit-tested | Functional pass; owner movement-speed and keyboard-layout review remain. |
| Responsive/runtime health | Added controls must not overflow or introduce runtime faults | At 767 × 898 the configuration stacked with zero horizontal overflow; desktop and narrow checks reported zero console errors or warnings | Pass. |

The first implementation used one spin taxonomy and surface-retention scalar across all incoming balls; this pass removes that mismatch. The remaining physics ledger is explicit: constants and impact behavior are research-calibrated rather than venue-measured, Quick Practice contact heights/paces are product defaults rather than claims about a universal player, and no Hawk-Eye-class trajectory or target-device player-perception validation has yet been performed.

## Stage 9: slow/deep trajectory intent and Lob/Overhead feed

| Comparison point | Intended behavior | Browser evidence | Result / remaining refinement |
| --- | --- | --- | --- |
| Independent depth | Recreational pace can target a deep first bounce without using clearance as an accidental depth control | Rally selected Groundstroke/Flat at 68 km/h, 0.36 m minimum clearance, and 9.5 m Landing depth; metadata and inline feedback both resolved `0.00, -9.50 m` / 9.5 m | Pass. Automated coverage separately resolves a 10.0 m target at the same pace and preserves launch magnitude exactly. |
| Physical infeasibility | Impossible pace/depth combinations must not be disguised | Setup compares Target and resolved depth and adds a closest-reachable or pre-net-bounce explanation when the error exceeds tolerance | Contract pass. Exact wording and whether named zones should supplement metres remain owner-review items. |
| Lob identity | Overhead practice receives a high lob rather than a repurposed volley | Clicking Overhead selected Lob/Topspin, opponent `1.1, 6.0 m`, 52 km/h, 3.2 m clearance, and 9.3 m depth; the visible arc crossed at 6.23 m and landed at `0.96, -9.29 m` | Functional visual pass. Apex/contact/pace remain player-calibration values. |
| Control density | Landing depth and Lob must fit the existing configuration hierarchy | The new range and target/resolved line fit Ball & rhythm at 1280 × 720; at 767 × 898 the page remained stacked with no horizontal overflow | Pass. |
| Runtime health | The broader angle search must not introduce visible faults | Groundstroke/Spin and Overhead/Lob interactions completed with zero console warnings/errors; 96 tests and production build pass | Correctness pass. Browser FPS observed during automation is not accepted as target-device performance evidence. |

The previous minimum-angle solve conflated obstacle clearance with depth and could even report a net crossing after a first bounce on an impossible low-speed feed. This pass makes that mismatch explicit and corrects the authoring model. The remaining ledger is calibration rather than architecture: measured recreational speed/spin distributions, lob apex preferences, and target-display perception still require player or instrumented evidence.

## Stage 10: Blender-authored Hard Open Arena pilot — 2026-09-05

Reference evidence: owner-supplied roof-removed overview and IOMEDIA Section 18 / Row L expanded interior view, supplemented by COX redevelopment and Robert Bird structural descriptions. No proprietary viewer imagery or geometry is shipped. These are visual proportions, not surveyed architectural plans.

| Comparison point | Delivered / observed | Remaining mismatch or gate |
| --- | --- | --- |
| Bowl massing | Continuous rounded-rectangle two-tier bowl, 32 sections, 13,216 individual instanced seats, broad intermediate concourse, stairs, rails, entry tunnels and hospitality band | Row counts, curvature, facade and section zoning are original approximations; no exact capacity or as-built match is claimed. |
| Roof silhouette | Fixed perimeter roof with ribbed dark underside, triangulated trusses, runways, parked sliding leaves and fixtures; explicit cutaway camera removes roof for overview comparison | Retraction machinery/animation and structural connection detail are simplified. |
| Court and palette | Regulation 10.97 × 23.77 m visible court registered to gameplay anchors, net sag and court furniture; blue `#24658d` / green `#4c775a` acrylic | Intentional deviation from the Australian Open's all-blue floor. Values are project sRGB approximations of a US Open-style arrangement, not manufacturer-certified color codes. |
| Materials and depth | CC0 concrete PBR maps, original acrylic textures, molded seat geometry and neutral vertex-AO bake | Three.js environment fill makes seats/roof brighter and flatter than the Cycles comparison; close-up wear, joinery and fine service details need refinement. No claim of final photorealism. |
| Branding/context | Original Tenmulate-only signs and scoreboard; complete simplified facade/podium | No tournament/sponsor marks, crowd, Melbourne precinct or bespoke broadcast equipment. |
| Runtime integration | Actual `TennisScene` renders the GLB; practice Return, venue switching and clay/hard changes work; gameplay and dynamic atmosphere remain TypeScript-owned | Only Hard Open Arena has an authored replacement. Default remains procedural pending owner acceptance. |
| Failure/offline behavior | Forced aborted downloads retain procedural court/venue; final GLB reloads offline after a successful production visit; no venue URL in Workbox precache | First-ever offline visit cannot retrieve an uncached GLB and uses fallback. Target-device cold-load and quota behavior still need profiling. |
| Responsive/runtime health | Player/corner/bowl/roof and day/night review; 1600 × 1000 and 390 × 844 layouts checked; a mobile header positioning bug was found and corrected; successful final production navigation logged zero console errors/warnings | 148 draws, about 1.81M rendered triangles and 11 textures in one desktop view. ANGLE selected Intel UHD; automated/background FPS is not a device performance gate. |

Final source/asset correctness: 129 tests and production build pass; raw glTF validation has zero errors/warnings, with separate optimized Meshopt decode/hash/registration checks. Final payload is 5,724,948 bytes. Local evidence (ignored, not redistributed): `artifacts/venue-build/browser-{player,corner,bowl,roof}-final.png`, `browser-mobile-night.png`, `browser-failed-download.png`, `practice-return.png`, `practice-clay-surface.png`, and `blender-{player,corner,overview}.png`. The Cycles and browser images are deliberately distinguished; a good offline render does not constitute browser visual acceptance.

## Stage 11: arena access, roof detail and shared lighting — 2026-09-05

The owner's new annotated Rod Laver sideline view and the supplied overlapping-entrance screenshot were inspected directly against actual Blender and browser output. Earlier flat-fill and underlit-dusk iterations were rejected. The final browser screenshots use production `TennisScene`, not substituted Cycles renders. The frontend testing skill guided the reference comparison, negative checks and mismatch ledger.

| Comparison point | Delivered / observed | Remaining mismatch or gate |
| --- | --- | --- |
| Two-layer perimeter | Separate 0.42 m low courtside boards and a 2.35 m padded retaining wall; four recessed doors cut through the wall with aligned board gaps; benches/coolers/umpire share the central service zone | All four exported approach volumes pass triangle-bound obstruction tests. These are modeled visual clearances, not a certified egress or as-built layout. |
| Seating/access contact | Front tier raised to allow 2.18 m high tunnels underneath; no freestanding concrete sheds or boards crossing entrances; apron reaches beneath the perimeter | Fine door hardware, realistic individual player chairs, wall seams and wear remain future detail. |
| Roof mechanics | Corrected 33 × 37 m open aperture; parked leaves clear the opening; paired transverse trusses, twin rails, bogies/wheels, drive housings, leaf underframes, catwalks and guardrails | Fixed open and visually interpreted. No animation, engineering load validation or exact Rod Laver reconstruction is claimed. |
| Branding | Tenmulate-only wall and low-board text | No tournament/sponsor art or viewer imagery is redistributed; blue/green palette remains the original project approximation. |
| Daylight | High directional sun lights the playing floor against roof-shadowed baseline surrounds and bowl; sky fill is lower and thin roof sheets block light correctly | Shadow-map edges remain finite-resolution. Direction follows the user's controls; new default is 145°, existing persisted directions are untouched. Not a claim of full Cycles GI. |
| Dusk | Warm/rose clouded sky, oblique sun patches across seating and the court, visible structural shadows, floodlights overlapping daylight for a readable playing surface | Art-directed schedule and color, not geolocated solar or photometric calibration. |
| Night | Full-power court lights, original night fill/exposure and dark roof/bowl retained | Target-device/display calibration remains open. |
| Shared fallback lighting | All six current venue choices render; hard/clay/grass outdoor arenas share day/dusk behavior, three indoor halls exclude the outdoor sun/sky and retain local illumination | Procedural fallback architecture remains deliberately lower detail; this pass does not author the other five venues. |
| Production routing/offline | Cached authored asset survives offline reload and offline Blender/procedural version navigation; review query parameters retain the correct HTML shell | Fixed a real service-worker fallback regression discovered in production review. First-ever offline authored load still requires procedural fallback. |
| Practice and responsive UI | Open in practice → Return → Golden hour renders the authored arena, Serve and time 18.5; 1600 × 1000 desktop and 390 × 844 review controls/canvas remain legible without horizontal overflow | Existing practice wheel-zoom passive-listener errors were reproduced and corrected with a canvas-owned non-passive listener and stable latest callback. Owner feel and target-device frame-time/memory/cold-load gates remain. |

Runtime acceptance record: 135 tests in 14 files pass (`npm test`), TypeScript plus production build pass (`npm run build`), the existing large-renderer-chunk warning remains. Correct page identity, nonblank content/canvas, no Vite overlay, visible controls and real interactions pass. Warm production/interaction console inspection reports zero errors and zero warnings. A fresh Intel ANGLE session emitted one nonfatal X4122 environment-shader precision warning; it is retained as a portability observation, not hidden. Final practice wheel input changes FOV 70° → 74° → 70° without its earlier passive-listener errors. Authored player sample: 156 draws, 1,836,062 rendered triangles, 11 textures; automation/background FPS is not performance acceptance.

Evidence is intentionally outside the shipped repository: `C:/Users/20378/.codex/visualizations/2026/09/05/arena-refinement/`. Final inspected files include `final-day-sideline.png`, `final-dusk-sideline.png`, `final-night-corner.png`, `final-{clay-sunset-arena,grass-center-court,timber-hall,clay-stadium,covered-grass-arena}-day.png`, the two outdoor `-dusk.png` captures, `final-procedural-hard-day.png`, `final-mobile-dusk.png` and `final-practice-return-dusk.png`. Blender MCP rebuilt the source and produced three separate Cycles comparison renders under ignored `artifacts/venue-build/`; those offline renders are not browser evidence. Review was tested on production port 4174 and the development view remains on 4173.

## Stage 12: Blender clay open arena — 2026-09-05

Primary references were inspected at actual image/page resolution: DVVD's completed-stadium interior photograph, Faraone's rebuilt-bowl photos and portal/glass details (PDF pp. 5–10, 13), FFT's venue/roof descriptions and the public roof teaching dossier (PDF pp. 6, 28). The [clay source record](clay-arena.md) links these sources and separates observation from estimated authoring dimensions. The indexed SL Rasch concept, pre-2019 green seats and other Roland-Garros courts were excluded. The PDF skill guided diagram inspection; the frontend-testing skill required actual browser comparison and negative checks.

| Reference / requirement | Final rendered evidence and correction | Intentional difference / remaining gate |
| --- | --- | --- |
| Rectilinear current bowl with pale timber seating | Two stepped tiers with chamfered corners, ash-colored curved seat shells, box divisions, aisle stairs/rails and terrace recesses; 14,686 decoded seat instances | 28 sections and 6,517/8,169 tier split are original approximations, not exact Philippe-Chatrier rows or capacity. |
| Light concrete and continuous glazed middle band | Limestone terraces, ivory fascias, silver glass rails and a blue-grey hospitality ribbon | Simplified suites, facade, joinery and structural connections; no claim of measured as-built geometry. |
| Green perimeter and court-level equipment | Four recessed player approaches, green wall interrupted at entrances, chairs/coolers/umpire and Tenmulate-only wordmarks | Original wider apron and equipment arrangement; no tournament/sponsor marks. Ground volumes pass actual-triangle checks against walls, first-row risers/stairs and furniture. |
| Realistic material detail without baked daylight | Original terracotta grain and normal/roughness maps, ash-grain shades, CC0 concrete and neutral vertex AO | Initial regular clay ripples were reduced. Close-up wear/rake marks and full Cycles GI are not claimed. |
| No bright gaps behind entries | Completed ground floors, taller rear linings, wider terrace floors and inward-visible opaque outer shell eliminate observed sky leaks | Openings are visual architectural recesses, not a navigable or certified egress network. |
| One-end nested roof wings | Ten cambered wings, paired runway beams, bogies/wheels/drives, fixed canopy ribs and independent fixtures; actual wing bounds clear the aperture | Ten rather than reference eleven wings, original profiles/proportions; fixed open, no retraction animation or engineering certification. |
| Shared daytime/dusk/night | Browser day lights clay against shaded stands, dusk adds warm raking patches and rose sky, night keeps the court readable under fixed lights | Same art-directed lighting as other venues; no new time system or photometric calibration. |
| Frontend replacement/fallback | Clay/hard selections reveal their own hash-validated GLBs, preserve native surface maps and hide procedural duplicates; other four venues remain procedural | Opt-in only. Target-device profiling and final owner visual acceptance still required. |
| Offline/failure/responsiveness | Both final assets reload offline; uncached forced clay failure visibly falls back; ordinary clay setup fetches no venue assets. Desktop and 390 × 844 view inspected | Existing cold ANGLE precision and occasional preload notices documented; final warm loop has zero console errors/warnings. |

**Verification:** 142 tests / 15 files; TypeScript and production build pass. Raw clay glTF: zero errors/warnings, 120 informational notices; optimized asset separately decoded and registered. Final GLB: `clay-sunset-arena.3268b70b2ec2.glb`, 7,296,132 bytes (6.96 MiB). Representative single-clay corner: 136 draws, 2,071,098 triangles, 15 textures; visiting both assets retains 21 textures. Background FPS is not acceptance evidence.

Local-only browser evidence: `C:/Users/20378/.codex/visualizations/2026/09/05/clay-arena/production-clay-{corner-day,corner-dusk,corner-night,sideline,bowl,roof,mobile}.png`, `production-practice-clay-return.png`, `production-default-procedural-clay.png` and `production-failed-clay-fallback.png`. `final-review-result.log` records final-hash offline/cache/identity/interaction checks and `negative-checks-result.log` records the deliberately isolated failure/default checks. The saved master was separately rendered in Cycles; browser screenshots above use the actual production `TennisScene`, never substituted offline renders.

## Stage 13: clay arena orthogonal seating — 2026-09-05

The owner's three additional Philippe-Chatrier photographs show straight rows, court-normal aisles, aligned terrace portals and rectangular lower boxes. A same-camera browser comparison exposed the previous generator's one-sided drift: section positions were fractions of the entire expanding perimeter, so the same section slid tangentially between rows. The frontend-testing skill guided reference comparison, desktop/mobile inspection and runtime checks; Playwright CLI was used because the Browser plugin/skill was unavailable. No new browser dependency or runtime rendering change was introduced.

| Reference / requirement | Revision 2 evidence | Intentional difference / remaining gate |
| --- | --- | --- |
| Court-normal seating and section divisions | Four independent straight stands; seat columns repeat at fixed 0.56 m world coordinates, with 1.12 m aisles on fixed 8 m sideline / 6 m baseline grids. Actual decoded GLB seat transforms and all eight straight-stand stair batches pass 3 mm alignment tolerances | These are original dimensions, not surveyed Chatrier rows or capacity. |
| Aligned tiers, portals and lower boxes | Both tiers share aisle axes; terrace portals are centered on those axes; front box partitions are rectangular. Same-camera sideline, corner and bowl captures show symmetric divisions without the old sideways drift | Only the four chamfer corners fan around the court; that transition is deliberate and symmetric. |
| Preserve the existing arenas' other details | Clay roof, court, perimeter entrances, furniture, textures and shared lighting retain their prior design. The hard arena and all runtime TypeScript are unchanged | Close-up realism, structural engineering and final owner acceptance remain separate gates. |
| Browser identity and visible result | Production review on port 4174 reports `Clay Open Arena — Tenmulate review`, authored clay `ready`, a nonblank canvas, and no framework overlay | The development review remains available on 4173; authored loading is still opt-in in normal practice. |
| Interactions and responsiveness | Sideline → Bowl → Sideline → Evening updates the rendered scene; daylight restored afterward. 1600 × 1000 desktop and 390 × 844 mobile inspected; mobile document width equals viewport width | Other devices/browser engines were not re-profiled. |
| Console and rendering health | Final warm production interaction loop has zero console errors/warnings. One initial Intel ANGLE X4122 precision warning was retained in cold-session evidence | Automated/background FPS is not performance acceptance. |

**Verification:** `npm test` passes 144 tests in 15 files; `npx tsc -b` and `npm run build` pass with the existing renderer-chunk size warning. Raw glTF validation: zero errors/warnings, 136 informational notices. The separately decoded/hash-checked optimized GLB is `clay-sunset-arena.fe716d0cf402.glb`, 6,168,972 bytes (5.88 MiB), with 13,664 seats (6,264 lower / 7,400 upper), 71 meshes and 17 materials. A production sideline sample reports 150 draws, 1,868,802 rendered triangles and 15 textures. The saved Blender master was also rendered and inspected in Cycles; that render is not substituted for browser evidence.

Local-only evidence: `C:/Users/20378/.codex/visualizations/2026/09/05/clay-seating/`. `before-sideline.png` and `final-sideline.png` provide the matched comparison; `after-corner.png`, `final-bowl.png`, `final-sideline-dusk.png` and `final-mobile.png` cover architecture and responsive lighting views. `seating-production-result.log` records page identity, authored state, overlay, dimensions and console/interaction checks. The initial integration's offline/failure matrix remains Stage 12 evidence; it was not rerun exhaustively for this asset-only refinement. The superseded GLB was replaced, not accumulated, and remains recoverable from Git history.

## Stage 14: clay arena translucent half-open roof — 2026-09-05

The owner's two supplied roof-underside photos (`6fc7c570` and `6544fc49`) show light-filtering ivory panels, visible longitudinal chords and fine curved secondary framing. They depict a closed roof; the requested delivered state is half-open. The frontend-testing skill required inspecting actual browser output. Playwright CLI was used because the Browser plugin/skill was unavailable; no browser dependency was added. The opaque prior roof, an overly see-through alpha trial and a flat high-roughness transmission trial were compared before choosing the final material.

| Reference / requirement | Final rendered evidence | Difference / remaining gate |
| --- | --- | --- |
| Translucent ceiling, no solid underside | Single double-sided membrane skins with rough glTF transmission (0.72 factor, 0.45 roughness), no opaque canopy soffit. From above, background geometry is softened rather than crisply visible through alpha glass; court-level material responds to blue day / warm dusk / dark night | Screen-space rough transmission approximates fabric diffusion. It is not measured membrane optics or full volumetric scattering. |
| Exposed trusses | Independent twin Warren wing girders, curved seam battens, triangulated canopy rafters and perimeter purlins. Opaque structural members cast visible shadows across clay and seats | Simplified connections and original dimensions; not structural certification. |
| Keep half open | Leading edge at Blender Y=-1.5 leaves 29.5 of the original 59 m aperture open; ten shingled wings retain 4.225 m pitch and overlapping bounds | Static half-open pose, no new roof animation. Northern fixed canopy remains under the nested leaves. |
| Preserve seating and hard venue | The 13,664 court-aligned seats and gameplay/access/light anchors pass existing decoded-asset tests. Hard source and GLB are unchanged; switching to hard renders its original opaque roof | Neutral AO is regenerated with the revised clay structure. |
| Correct frontend identity and interactions | Production port 4174 loads `e395c0728971`, reports authored clay `ready` with the correct title, nonblank canvas and no framework overlay. Sideline → Roof → Corner → Evening → Night and mobile views were inspected | Browser output is not substituted by the separate successful Cycles render. |
| Responsive and console checks | 1600 × 1000 desktop and 390 × 844 mobile; mobile scroll width equals viewport width. Final warm day/dusk/night interaction loop reports zero warnings/errors | Existing cold Intel ANGLE X4122 shader precision warning remains documented. |
| Cached reload and fallback | Final GLB and manifest reload offline after a controlled online visit. An earlier offline attempt had only the GLB cached, not the first-visit manifest, and visibly used procedural fallback | Both resources must be cached; that diagnostic's expected failed-fetch/fallback logs are separate from clean visual QA. Full default/forced-failure matrix remains Stage 12 evidence. |

**Verification:** 146 tests in 15 files and production build pass, with the existing renderer-chunk warning. Actual GLB tests check half opening, overlapping wings, 100 m spans, eleven transmissive double-sided skins and separate opaque trusses; loader tests cover membrane shadow handling and cutaway visibility. Raw glTF validation: zero errors/warnings, 138 informational notices. Final asset is 7,338,204 bytes (7.00 MiB), 73 meshes and 17 materials, using the already supported `KHR_materials_transmission` extension. Only the current hash is present in both public and production output.

**Performance gate:** transmission introduces a render pass. Final single-clay sideline reports 217 draws / 3,565,782 rendered triangles / 16 textures, versus revision 2's 150 / 1,868,802 / 15. These are render-work counters, not a measured target-device frame-time result. Device profiling and owner visual approval remain open; the authored option is not promoted to default.

Local-only evidence: `C:/Users/20378/.codex/visualizations/2026/09/05/clay-roof/`. Matched `before-sideline.png` / `final-sideline-day.png`, `before-roof.png` / `final-roof-day.png`, plus `final-corner-{day,dusk,night}.png`, `final-mobile-dusk.png` and `final-hard-unchanged.png` document the reference comparison. `production-qa.log` records identity/state/current asset/console/viewport results; `cached-offline-qa.log` records the completed offline proof; `switch-offline-qa.log` retains the earlier uncached-manifest diagnostic. The superseded tracked export is recoverable in Git; rejected trial files were moved out of the shipped tree into this evidence directory.

## Stage 15: clay roof opacity and even court shade — 2026-09-05

The owner reported excessive roof transparency and distracting truss-only shadows. Matched sideline browser captures confirm the cause: the previous membrane was explicitly excluded from the sun depth map. The frontend-testing skill required actual browser comparison; Playwright CLI was used because the Browser plugin/skill was unavailable, without adding a project dependency.

| Mismatch / check | Final evidence | Boundary |
| --- | --- | --- |
| Ceiling too transparent | Blender transmission 0.72 → 0.32 and roughness 0.45 → 0.58; exported material retains alpha 1 and double-sidedness | Rough transmission remains an approximation of light-filtering fabric. |
| Truss stripes obscure the court | All eleven skins cast continuous roof shade; matched before/after daylight shows readable lines without repeated dark steel stripes | An initial full-strength shadow trial was too dark and rejected. |
| Covered court brightness | Authored membrane transmission yields sun-shadow strength 0.68 and PCF radius 4, preserving useful fill under the roof | Bounded allowance affects the active venue's sun map, not per-material optical transport; no new shadow map. |
| Half-open roof and unrelated venues | Existing geometry tests pass; browser roof cutaway restores strength 1, sideline restores 0.68, hard and procedural grass both use 1 | No hard asset, seating, atmosphere schedule or exposure changes. |
| Identity / nonblank / overlay | Production port 4174 loads clay `1b7581f25a2c`, reports authored clay `ready`, correct title and nonblank court, zero framework overlays | Local production preview, not deployed. |
| Desktop / mobile / interactions | 1600 × 1000 and 390 × 844; mobile scroll width 390. Day → evening → night → roof cutaway → hard → grass → clay completes | Day, dusk, night and mobile screenshots inspected. |
| Console | Final warm production loop has zero errors/warnings | Existing cold Intel ANGLE X4122 precision warning remains, separate from the warm loop. |

**Verification:** `npm test` passes 146 tests in 15 files; `npm run build` passes with the existing renderer-chunk warning. The Blender build and decoded GLB geometry/material/hash checks pass. Raw glTF validation: zero errors/warnings, 138 informational notices. Current export is 7,338,204 bytes, 73 meshes and 17 materials; the old export is removed from public output and remains recoverable in Git.

**Performance / remaining gates:** single-clay sideline reports 228 draws / 3,574,022 rendered triangles / 16 textures, versus revision 3's 217 / 3,565,782 / 16. The existing transmission pass remains; these counters are not a target-device frame-time benchmark. Device profiling and owner visual acceptance remain open. No fresh Cycles render or offline-cache matrix was required for unchanged geometry/transport; prior offline evidence must not be mistaken for a new-hash offline check.

Local-only evidence: `C:/Users/20378/.codex/visualizations/2026/09/05/clay-roof-shade/`. `before-day.png` and `final-day.png` are matched daylight comparisons; `final-dusk.png`, `final-night.png` and `final-mobile.png` capture the other inspected states. `production-qa.log` records asset identity, viewport, cutaway/venue resets and empty issue list. `after-day-first.png` retains the rejected overly dark first trial; `build.log` records the Blender rebuild.

## Stage 16: third Blender arena — garden grass — 2026-09-05

The owner requested a grass arena informed by modern Centre Court without the real venue's visible identity, then supplied Leon Labyk's ArtStation model as an additional reference. The PDF skill guided visual inspection of the official seating schematic; the frontend-testing skill required real browser comparison. Browser plugin/skill was unavailable, so Playwright CLI was used with no project dependency added. Source decisions, published facts and estimated row/bowl/roof dimensions are in [Grass arena](grass-arena.md).

| Reference / requirement | Final rendered or decoded evidence | Difference / remaining gate |
| --- | --- | --- |
| Rounded rectangular compact green bowl | 12 lower, 26 main and six gallery rows with 14,381 actual linked seats; fixed court-normal straight aisles and circular corner fans; separate reserved baseline pavilion | Rake/row inventory and curve dimensions are authored estimates, not surveyed as-built geometry. Gallery stops behind south pavilion/corners. |
| Green lawn and playing-area continuity | Exact 22 × 41 m lawn and regulation anchors; continuous mowing-strip UVs across court/runoff, original albedo/normal/roughness maps, independent fibre-map tiling | The first dark colour pass was rejected; final macro colour matches the bright lawn / dark bowl contrast. No photographic texture or baked sunlight. |
| Dark canopy and white structural banks | Opaque grid soffit, deep reveal, two banks of five 77 m-span cambered lattice trusses, eight dense folded skins, rails/bogies/drives; front axes at ±34.7 m | Full structural bounds clear the 61 × 68 m aperture after a test caught a 2 cm intrusion in the trial. Static open pose; no roof-control animation. |
| Plausible enclosure and access | Continuous inner enclosure/foundation closes initial sky leaks. Four player body volumes avoid all tested first-row terraces/stairs/frames/furniture. Pavilion occupies omitted seating | Simplified exterior, no full precinct or engineering certification. |
| Original neutral identity | Runtime node/material/extras test excludes reference-event and sponsor names. Visible wordmarks/scoreboards are generic Tenmulate | References retained only in development provenance; this is not legal clearance. |
| Correct actual renderer | Production port 4174 loads `7d25bddb4c7e`, titled Grass Open Arena, authored/ready, meaningful nonblank scene and no overlay | Separate Cycles render is source proof, not a substitute for browser inspection. |
| Interaction / responsive / lighting | Player → Corner → Sideline → Roof → Bowl; day → evening → night; 1600 × 1000 and 390 × 844, mobile scroll width equals viewport. Hard/clay/grass/procedural switches restore expected shadow strength 1 / 0.68 / 0.78 / 1; cutaway uses 1 | Clean warm loop has zero warnings/errors. Existing initial Intel ANGLE shader precision warning is recorded separately. |
| Offline / failure / default | After a controlled online reload, final manifest and GLB are cached and offline reload remains authored/ready. Fresh SW-blocked context forces GLB 503 and visibly falls back to procedural grass. Default main application requests no venue assets | First page visit before SW control did not cache grass; this was identified before the successful controlled reload, not presented as offline-ready. |
| Main practice integration | At `/?venueAsset=blender`, Venue → Outdoor Arena · Grass loads authored/ready grass and updates Surface to Grass. Start practice displays the room-safety prompt; Cancel returns to the rendered setup. No console issues or framework overlay | QA does not attest to physical room clearance; active practice beyond that safety gate was not exercised. |

**Verification:** `npm test` passes **154 tests / 16 files**; `npm run build` passes with the existing renderer-chunk warning. Blender builder and native Cycles render pass. Raw glTF validation: zero errors/warnings, 135 informational notices. Packed master 18,764,966 bytes; optimized GLB 6,353,976 bytes (6.06 MiB), 74 meshes, 19 materials and 556,164 texture bytes. Only the final grass hash is present in public and production output. Hard/clay source and asset diffs are empty.

**Performance / remaining gates:** final single-grass corner/day reports 235 draws / 3,404,818 rendered triangles / 10 textures; after all three authored venues are loaded, the switch study reports 24 textures. These counters are not a controlled frame-time benchmark. The existing rough-transmission pass, target-device frame times, memory/cold loads and owner art approval remain open. The default stays procedural; this is local implementation, not deployed release approval.

Local-only evidence: `C:/Users/20378/.codex/visualizations/2026/09/05/grass-arena/`. `reference-plan.pdf/.png`, `artstation-first.png` and `artstation-seating.png` record inspected references, not shipped assets. `first-{corner,player,roof}.png` and `refined-{corner,player}.png` retain the mismatch iterations. Final gallery: `final-{corner,player,sideline,roof,bowl}-day.png`, `final-corner-{dusk,night}.png`, `final-mobile-dusk.png`, `final-cached-offline.png`, `final-forced-fallback.png`, `final-main-practice-setup.png`. `production-qa.log`, `resilience-qa.log` and `main-practice-qa.log` record state/identity/interactions/console/default/offline/failure and practice-setup checks. `blender-corner.png` and `cycles-review.log` record native source rendering; `build-final.log` records export. Rejected trial GLBs were moved here from public output, not deleted irrecoverably.

## Stage 17: grass contrast and all-venue net density — 2026-09-05

The owner supplied a darker grass court reference (`63b4644c`) and requested more prominent nets on all courts. The frontend-testing skill guided matched reference/browser comparison; Browser plugin/skill was unavailable, so Playwright CLI was used without a project dependency addition. The flow under test is venue review → authored/fallback venue and lighting selection → darker grass, readable white lines and tighter nets with unchanged gameplay registration.

| Mismatch / check | Evidence | Boundary |
| --- | --- | --- |
| Grass too pale/yellow | Palette `#839d49` → `#64843d`; matched 1600 × 1000 player screenshots show greener grass. Sample patch linear luminance 0.346 → 0.231; sampled white-line/patch contrast 1.82 → 2.69 | Measurements use a fixed lawn patch and visible service-line pixels, not a whole-image score or accessibility certification. White paint, stripes, wear and lighting parameters are unchanged. |
| Authored net too sparse | Shared helper changes roughly 67 mm columns to nominal 42 mm, radius 1.7 → 2.2 mm; all three decoded assets have 306 vertical cords and 24–25 horizontal courses | Opaque solid cords, original sag/posts/headband/anchors. Fine raster aliasing and bright grazing light remain device-dependent. |
| Procedural net too coarse | Vertical divisions 64 → 269, same nominal 42 mm pitch, darker line colour. All six fallback identities exercised | First 0.9-opacity trial was too solid; final 0.68 opacity compensates for fixed one-pixel WebGL lines. It is screen coverage, not a physical cord diameter. |
| Identity / meaningful scene / overlay | Production `127.0.0.1:4174` shows Grass Open Arena, authored/ready, nonblank court, no framework overlay; hard/clay identity also checked | Local production preview, not public deployment. |
| Console / controls / mobile | Three authored → all six procedural → grass; Player → Corner → evening → night → daylight; 1600 × 1000 and 390 × 844, mobile scroll width 390; zero warm console issues | Existing cold Intel ANGLE precision warning retained separately. Other browser engines/device performance not certified. |
| Geometry / loading scope | Same 13,304 / 13,664 / 14,381 seat counts and gameplay anchors; all existing entrance/roof/UV tests pass; no lighting or loader changes | Prior offline/failure matrix is Stage 16 evidence, not a fresh all-hash offline test. |

**Verification:** 158 tests in 17 files; production build passes with the existing renderer chunk warning. All three Blender builders succeed. Raw validators: zero errors/warnings (194 hard / 138 clay / 135 grass informational notices). New tests decode each shipped weave's real triangle count, bounds and thickness and test the grass texture's luminance/green balance. Current hashes are `740783a4d427` hard (5,835,492 bytes), `852c6e18f981` clay (7,423,392), `445e52687ec8` grass (6,393,484). Only those hashes ship; old exports are recoverable in Git.

**Render-work boundary:** matched player views keep draw calls unchanged (156 hard / 226 clay / 231 grass), with approximately 13,080 / 19,620 / 19,620 additional rendered triangles respectively. Texture counts remain unchanged. This is not a frame-time benchmark; automated/background FPS and the existing transmission pass do not establish target-device acceptance. Owner art approval and performance profiling remain open.

Local-only evidence: `C:/Users/20378/.codex/visualizations/2026/09/05/grass-net-refinement/`. `before-{grass-center-court,hard-open-arena,clay-sunset-arena}-player.png` and matching `after-*` captures show the authored comparison; `before-procedural-player.png` / `after-procedural-player.png` show fallback density. `after-grass-{corner-day,evening,night,mobile}.png`, `production-qa.log`, `contrast-metrics.json` and three `build-*.log` files record the final visual/technical checks. The first interrupted baseline capture occurred when the checkout switched to main; it was discarded and repeated after the owner authorized returning to the feature branch.

## Visibility calibration: optic ball and outlined opponent

| Comparison point | Intended behavior | Browser evidence | Result / remaining refinement |
| --- | --- | --- | --- |
| Ball hue | Competition-yellow compliance without the previous pure-yellow appearance | The shared ball material moved to a saturated optic yellow-green authoring value with high felt-like roughness and restrained emissive lift; Return visibly retained the hue from the far launch through the near court | Pass for renderer intent. The ITF specifies only white or yellow, not a numeric display value; target-display approval remains open. |
| Opponent fill | The distant neutral carrier remains visible across light and dark scenes | The texture-free GLB now renders warm white under scene lights in both Outdoor Arena · Hard and Indoor Court · Hard | Pass at baseline distance. This is still a low-detail carrier, not close-up character art. |
| Silhouette edge | A black contour follows the opponent without becoming a second static character | Back-face outline clones share each source mesh's geometry and live skeleton. The first 18 mm hull fell below one pixel; the calibrated 45 mm render hull remained visible at the far baseline | Pass in the current browser. Verify extreme mocap poses and other browser/display antialiasing paths later. |
| Physics isolation | Visibility cannot change gameplay | Ball scale/material and opponent outline remain renderer-only; collision, trajectory, opponent height, court position, and animation contracts are unchanged | Architectural and automated-test pass. |
| Responsive/runtime health | The new pass cannot overflow UI or introduce shader failures | Desktop and 767 × 898 comparisons showed the new materials in the court view, compact `scrollWidth = clientWidth = 752`, and zero console warnings/errors | Pass. Target-device GPU profiling remains open. |
