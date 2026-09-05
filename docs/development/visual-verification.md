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

## Visibility calibration: optic ball and outlined opponent

| Comparison point | Intended behavior | Browser evidence | Result / remaining refinement |
| --- | --- | --- | --- |
| Ball hue | Competition-yellow compliance without the previous pure-yellow appearance | The shared ball material moved to a saturated optic yellow-green authoring value with high felt-like roughness and restrained emissive lift; Return visibly retained the hue from the far launch through the near court | Pass for renderer intent. The ITF specifies only white or yellow, not a numeric display value; target-display approval remains open. |
| Opponent fill | The distant neutral carrier remains visible across light and dark scenes | The texture-free GLB now renders warm white under scene lights in both Outdoor Arena · Hard and Indoor Court · Hard | Pass at baseline distance. This is still a low-detail carrier, not close-up character art. |
| Silhouette edge | A black contour follows the opponent without becoming a second static character | Back-face outline clones share each source mesh's geometry and live skeleton. The first 18 mm hull fell below one pixel; the calibrated 45 mm render hull remained visible at the far baseline | Pass in the current browser. Verify extreme mocap poses and other browser/display antialiasing paths later. |
| Physics isolation | Visibility cannot change gameplay | Ball scale/material and opponent outline remain renderer-only; collision, trajectory, opponent height, court position, and animation contracts are unchanged | Architectural and automated-test pass. |
| Responsive/runtime health | The new pass cannot overflow UI or introduce shader failures | Desktop and 767 × 898 comparisons showed the new materials in the court view, compact `scrollWidth = clientWidth = 752`, and zero console warnings/errors | Pass. Target-device GPU profiling remains open. |
