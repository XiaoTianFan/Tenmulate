# Visual verification ledger

- **Purpose:** Record concept-to-browser inspection after every implementation stage
- **Reference viewport:** 1920 × 1080 unless stated otherwise

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
| Volley identity | Volley must not be a baseline groundstroke with another label | Volley moved the opponent to `0.0, 3.7 m`, selected 62 km/h/0.16 m clearance, disabled spin, and produced a shorter `0.00, -4.64 m` first landing | Pass. Opponent animation/contact-pose fidelity remains dependent on production mocap. |
| Bounce control | Perceptual adjustment is explicit and cannot rewrite incoming flight | Ball arrival exposes 0.60×–1.40×; automated evidence keeps launch velocity identical and orders post-bounce apex low < natural < high | Architectural/test pass. Browser range-drag automation was not accepted as evidence; owner feel review remains. |
| Surface response | Surface changes rebound through physical contact parameters | Automated rebound samples show higher-friction clay losing more horizontal speed and rebounding higher than grass under the same incoming shot | Research-calibrated pass; measured court fitting remains external. |
| WASD continuity | Held movement works after ordinary controls retain focus | Pressing A while Shot type remained focused cleared the active Baseline preset without changing the selected Volley profile; diagonal/time-step behavior is unit-tested | Functional pass; owner movement-speed and keyboard-layout review remain. |
| Responsive/runtime health | Added controls must not overflow or introduce runtime faults | At 767 × 898 the configuration stacked with zero horizontal overflow; desktop and narrow checks reported zero console errors or warnings | Pass. |

The first implementation used one spin taxonomy and surface-retention scalar across all incoming balls; this pass removes that mismatch. The remaining physics ledger is explicit: constants and impact behavior are research-calibrated rather than venue-measured, Quick Practice contact heights/paces are product defaults rather than claims about a universal player, and no Hawk-Eye-class trajectory or target-device player-perception validation has yet been performed.
