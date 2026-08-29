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
| Appearance/physics independence | Visual court may differ from bounce profile | Clay appearance and grass bounce profile remained independently selected; the rendered court was clay | Pass. |
| Camera coverage | Baseline, transition, net, and overhead views | Eight presets and six continuous camera axes are present; reset restores the documented realistic view | Pass. |
| Rehearsal instrumentation | Quiet primary view with optional detailed diagnostics | Settings panel shows five audio channels, ball options, net clearance, pre/post-bounce speed, arrival, and renderer metrics | Pass. |
| Ball accessibility | Visibility help cannot alter the physical path | High-contrast scale/material and ten-sample trail are renderer-only settings | Architectural and interaction pass. |
| Responsive setup | Compact devices configure safely without pretending to be ideal practice displays | 1280 × 820 remained usable; 820 × 1000 stacked cleanly with no horizontal overflow and showed the large-display recommendation | Pass. |
| Performance behavior | 60 fps target with adaptive quality, no unearned high-refresh claim | Auto/performance/quality controls report actual pixel ratio; 90/120 option remains hidden | Pass for local browser; reference-device profiling remains external. |
| Runtime health | No console or renderer error in the final interaction path | 1920 × 1080 setup and live rest/diagnostic state showed zero console errors/warnings | Pass. |

The final setup and rehearsal screenshots were inspected directly with `view_image`. The procedural opponent and venue are explicitly functional stand-ins and were not judged as production-asset fidelity.
