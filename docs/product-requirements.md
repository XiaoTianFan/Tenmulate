# Product requirements: first-person tennis simulation

- **Status:** Draft, with V1 boundary accepted in ADR-0002
- **Working title:** Tenmulate
- **Last updated:** 2026-08-30
- **Target release:** Public-free V1 tennis visualization product

## 1. Product summary

Tenmulate is a browser-based tennis rehearsal tool for a TV, monitor, or projector. It presents a game-realistic, first-person on-court view of an animated opponent and physically credible incoming balls so a player can shadow-swing, rehearse recognition, and mentally model timing and tactics without a foreground avatar or racket.

V1 is a complete configurable visualization product. It includes baseline rallies, return practice, net play, tactical sequences, camera movement, local drill authoring, and offline reuse. It does not observe the user. V2 is defined by an explicitly started camera and machine-learning pipeline that detects player movement and can synchronize the virtual camera or training response to it.

## 2. Problem

Players may understand a tactical pattern verbally yet struggle to rehearse its visual cues, pacing, spacing, rhythm, coordination, and timing away from court. Match video fixes the camera outside the player's body, while conventional games emphasize controller input and entertainment. Tenmulate should reproduce the perceptual problem a player sees: opponent preparation, contact, ball flight, bounce, arrival, and position changes from a credible player-eye perspective.

## 3. Goals

1. Make direction, depth, height, speed, spin, bounce, and post-bounce arrival visually legible from a believable POV.
2. Let players at different levels configure pace, frequency, variation, and cue density to create an appropriate challenge.
3. Support every requested V1 practice family: baseline, return, tactical patterns, approach/volley, serve-and-volley, and overheads.
4. Keep the active view quiet: court, readable neutral opponent, ball, restrained cues, and no near-player body or racket.
5. Support deterministic repeat, bounded randomization, slow motion, exact replay, and a local timeline drill editor.
6. Adapt to varied displays, rooms, and preferences with a defensible realistic default plus user-controlled camera position, zoom/FOV, gaze, and motion comfort.
7. Establish one browser rendering and asset pipeline that can later accept freemium entitlements and V2 body tracking without replacing the simulation core.

## 4. V1 non-goals

- Camera capture, user body/racket/swing tracking, or virtual-camera movement driven by detected movement.
- Technique grading, injury-prevention claims, or automated coaching claims.
- A first-person racket, hands, arms, or near-player avatar.
- Multiplayer, an autonomous opponent AI, or complete match rules/scoring.
- Native mobile, VR, or AR applications.
- Runtime text/image/video-to-3D generation for end users.
- Accounts, payments, premium entitlements, cloud synchronization, or a content marketplace in the initial public-free release.

These exclusions do not make V1 a prototype. They define the complete non-tracking, public-free product boundary.

## 5. Users and context

### 5.1 Primary users

- The project owner as the first real player and acceptance tester.
- Self-directed adult and junior players across recreational, club, and competitive levels.
- Players training tactical visualization, pacing, rhythm, coordination, recognition, and timing away from court.

### 5.2 Coaches

Coaches can select or author drills, configure shot and camera parameters, inspect technical metrics, and export/import drill definitions for players. V1 does not claim to evaluate the player's physical execution.

### 5.3 Expected environment

- A modern desktop or laptop browser connected to a monitor, TV, or projector of varying size and resolution.
- Full-screen use where the player has independently cleared enough physical space to shadow-swing safely.
- Mouse, keyboard, touchpad, or remote-like controls during setup, with minimal interaction during playback.
- Optional offline reuse after the first successful load.

No single TV/projector, viewing distance, room, or GPU defines the product. Reference performance tiers will be measured during the vertical slice.

## 6. Product principles

1. **Perceptual truth before decorative realism.** Timing, scale, contact, bounce, and readable motion matter more than stadium spectacle.
2. **Realistic default, deliberate freedom.** Start from a credible eye-level baseline view, then let users adjust FOV/zoom, position, angle, look target, and motion intensity.
3. **Challenge is configurable.** Ball pace, interval/frequency, spin, height, depth, location variance, sequence length, camera motion, and cues are independent controls with useful presets.
4. **Court-space, not user handedness.** Because V1 renders no user body or swing, shot targets are authored as near-left, body/middle, and near-right. The setup does not ask for user handedness.
5. **Opponent motion carries information.** Preparation, serve rhythm, contact, recovery, and handedness must cue the incoming ball rather than merely decorate it.
6. **Quiet during motion.** Configuration UI recedes during a repetition; cues do not cover the opponent or ball.
7. **Predictable repetition.** A seed reproduces the same ball, animation, camera, and cue timeline.
8. **Safe and comfortable by construction.** Immediate pause, practice-space reminder, reduced motion, and conservative default camera acceleration are mandatory.
9. **Local and private by default.** V1 requires neither a camera nor an account.

## 7. V1 scope: all items are must-have

### Environment and view

- Standards-dimension singles court and net, with selectable hard, clay, and grass surfaces whose material and bounce profile change together.
- Six complete venue identities using one `{setting} · {surface}` naming contract: Outdoor Arena and Indoor Court variants for hard, clay, and grass. One surface selection controls both appearance and bounce behavior without duplicating regulation court geometry.
- Every venue includes umpire/rest furniture, believable access/context, and appropriate perimeter fencing, walls, or stadium structure. Outdoor arenas include spectator seating without required crowd models; indoor courts remain seating-free halls.
- Outdoor venues expose sun direction plus daytime/night presets and floodlights. Indoor venues expose artificial-light intensity/color presets and, where windows/skylights/roof openings exist, optional daylight influence.
- Venue architecture and seating preserve an uncluttered opponent preparation, contact, ball-flight, and bounce visibility corridor from every required player camera.
- Game-realistic visual direction: courts are built as canonical code-owned Three.js compositions with physically credible materials, lighting, architecture, props, and planting. The opponent is a neutral faceless humanoid whose readable silhouette and mocap fidelity take priority over appearance detail.
- The initial product and vertical-slice visual baseline is the accepted bright outdoor blue/green hard-court public-club environment (concept Panel 1). This establishes implementation order, not an exclusive final theme.
- Default camera at 1.70 m eye height, centered 1.5 m behind the near baseline, with a one-action realistic reset.
- User controls for eye height, lateral/longitudinal position, camera yaw/pitch/look target, FOV/zoom, and physical-view versus immersive mode.
- Center, both baseline corners, approach, first-volley, second-volley, and overhead camera presets plus forward/back/lateral authored paths.
- Reduced-motion alternatives for every moving-camera drill.

### Ball and opponent

- Incoming forehands, one- and two-handed backhands where content calls for them, serves, approach feeds, volleys, half-volleys where needed, lobs, and overhead feeds.
- Target-practice controls for launch speed, frequency/interval, shot-aware spin type and rpm, landing depth/direction, post-bounce arrival, and bounded location/timing variation. Net clearance is a profile-owned safety constraint, not a parallel manual-ballistics control.
- Cross-court, middle/body, down-the-line, inside-out, inside-in, short-angle, defensive, neutral, approach, and finishing intentions.
- Opponent idle, split-step, footwork, recovery, forehand, backhand, serve, volley, and overhead clips synchronized to exact ball contact.
- Both left- and right-handed opponents. Mirrored clips may ship only where biomechanical and visual review passes; otherwise use distinct motion.
- Flat, slice, and kick/topspin serve families for deuce/ad boxes and T/body/wide locations.
- Two independent serve-motion rhythms for each supported opponent hand:
  - **Normal:** relatively high toss, visible loading into a lower/deeper trophy position, then acceleration to contact.
  - **Compact:** low toss and immediate upward swing with shorter preparation and a faster visual rhythm.
- Serve-motion rhythm and ball pace are independent; choosing compact cannot silently force a faster ball.
- Opponent production prioritizes motion silhouette, footwork, racket path, contact, and clean deformation over facial close-up detail; the normal opponent distance does not justify expensive high-resolution facial assets.
- The active ball uses an optic yellow-green, felt-like renderer presentation with a restrained emissive lift. The neutral opponent uses a white relightable surface plus a persistent black silhouette contour; both treatments are presentation-only and cannot alter physical paths, collisions, or opponent scale.
- Opponent rackets are reusable rigid props attached to named left/right hand sockets; they are not fused into the base character mesh.
- The regular Rally origin defaults to 1.0 m behind the far baseline. Free opponent placement covers the full international-competition floor envelope: 6.40 m behind each baseline and 3.66 m outside each doubles sideline.
- The Quick Practice Volley rail preset is receiver-oriented: it moves the user camera to the net position while retaining a regular behind-baseline opponent and incoming Groundstroke feed. The explicit Volley shot type remains available when the user intentionally wants the opponent to strike a volley.

### Drills, editor, and feedback

- Quick Rally, Return Practice, Tactical Pattern, Serve-and-Volley, Net/Overhead, and Custom entry points.
- Single-shot repeat, ordered sequences, seeded bounded randomization, exact replay, slow motion, pause/resume/restart, repetition count, interval, and work/rest blocks.
- Strategic combinations including the requested cross-court/down-the-line pattern and serve-and-volley sequences with first volley, second volley, lob, and overhead repositioning.
- A local timeline editor with opponent, ball, camera, cue, and rest tracks, constrained to validated content primitives.
- JSON drill export/import with schema versioning and pre-play validation.
- A direct trajectory-line on/off control; no separate mode label for the same visual choice.
- A trajectory-hover tooltip rendered over the court for launch speed, spin rate, solved angle, apex, actual net clearance, landing/error, pre/post-bounce speed, and receiver-plane arrival; calculated metadata does not occupy the setup panel.
- One neutral faceless opponent carrier for V1, with both handedness modes and mocap-driven clip families; venue ambience is optional and off by default. Additional appearances are a later content concern, not a V1 dependency.
- Contact, bounce, countdown, footwork cue, and ambience audio with independent controls and text/visual equivalents where needed.
- Offline application reuse and cached selected drills/assets after the first successful online load.
- A 60 fps default target plus an optional 90/120 fps mode that appears only when capability checks and a short runtime benchmark pass.

## 8. V2 boundary

V2 adds an explicitly enabled, real-time visual movement-detection pipeline:

- Camera permission and clear active-capture state.
- On-device pose/movement inference by default, isolated from rendering in a worker or equivalent boundary.
- Calibration from camera observations to player/court coordinates.
- Confidence, occlusion, latency, lost-tracking, and safe-fallback behavior.
- Virtual-camera position and drill timing synchronized to detected player movement.
- Movement/timing feedback only after its validity and product claims are reviewed.

Accounts, premium entitlements, cloud content, and payments belong to a separate post-V1 commercialization track. They must reuse the same rendering/simulation/content pipeline and must not be treated as prerequisites for V2 tracking.

## 9. Functional requirements

### 9.1 Setup and calibration

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| CAL-01 | Support optional physical display calibration. | Given visible screen width/height or diagonal/aspect plus viewing distance, the app derives physical horizontal/vertical FOV and shows the entered values. |
| CAL-02 | Support camera preference controls. | Eye height, baseline offset, lateral offset, yaw, pitch, and FOV/zoom update without changing court or ball coordinates; left-drag directly adjusts yaw and pitch through a full 360° range, while the wheel over the court adjusts horizontal FOV from 5° to 160°. |
| CAL-03 | Provide a predictable reset. | A single action applies the first camera-position preset plus the first perspective preset. |
| CAL-04 | Save decoupled view presets locally. | Camera position and perspective are separate collections; users can combine them, create presets, and right-click an existing preset to update it. |
| CAL-05 | Run a visual scale check. | Court-width/net-height and ball-size checks can be revisited without restarting a drill. |
| CAL-06 | Confirm a clear practice area. | First use presents a short safety acknowledgement and never claims to measure the room. |
| CAL-07 | Support free setup movement. | Held-key WASD moves the camera continuously and frame-rate-independently without changing the selected ball or opponent configuration; A is player-view left and D is player-view right, and movement remains available after a select, range, or button retains focus. |

### 9.2 Court and point of view

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| POV-01 | Render regulation geometry in SI units. | Singles width is 8.23 m, full length 23.77 m, service line distance is 6.40 m from the net, and net height is 0.914 m at center and 1.07 m at posts. |
| POV-02 | Keep surface appearance and physics coherent. | One hard/clay/grass selection updates both the court material and its bounce profile; saved preferences and rehearsal launches contain one canonical surface identifier. |
| POV-03 | Keep the near player absent. | No near-player limb, body, or racket appears during V1 playback. |
| POV-04 | Provide full-screen rehearsal. | Controls hide and restore with one keyboard-accessible action and pause remains discoverable. |
| POV-05 | Keep camera motion independent. | Camera transforms never alter shot coordinates, event timing, or deterministic replay. |
| POV-06 | Supply complete venue context. | The catalogue contains exactly three outdoor arenas and three seating-free indoor courts, with one hard/clay/grass variant in each setting and uniform `{setting} · {surface}` labels. Every scene retains umpire/rest furniture and safe gameplay corridors. |
| POV-07 | Configure one coherent atmosphere. | Outdoor time of day and clear/overcast/rain settings alter sky scattering, sun, ambient diffusion, fog, reflections, precipitation, and procedural wetness together. Indoor visible fixtures align with their real light sources. Lighting never changes court coordinates or replay. |
| POV-08 | Keep every environment code-owned. | All six visible scenes are composed from typed Three.js geometry, shader-material, atmosphere, and weather modules; no generated mesh, splat, panorama, iframe, or world-model output participates in runtime rendering or spatial authority. |
| POV-09 | Make every visible venue surface procedural. | Court, ground, seats, walls, roofs, metal, timber, planting, and ad-board materials derive their visual variation from deterministic custom shaders without downloaded venue textures. |

### 9.3 Ball simulation

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| BALL-01 | Model gravity, quadratic drag, and spin-dependent Magnus lift in 3D. | Flat, topspin/kick, slice, and sidespin samples match checked-in numerical goldens within agreed tolerances. |
| BALL-02 | Model impact separately from free flight. | Surface profiles affect normal restitution, horizontal velocity loss, and spin coupling; every shot reports pre/post-bounce state. |
| BALL-03 | Author by meaningful outcomes. | Quick Practice specifies source/contact profile, launch speed, spin type/rpm, landing depth/direction, and post-bounce arrival rather than opaque raw vectors or a manual-ballistics mode. |
| BALL-04 | Prevent tunneling and refresh-rate drift. | The solver finds the first court/net event within a step and produces the same outcome under 30/60/90/120 Hz rendering. |
| BALL-05 | Keep fast balls visible without changing physics. | Optional blur/trail/halo affects presentation only; the debug path always shows the computed centroid trajectory. |
| BALL-06 | Validate legality and authored intent. | Invalid service boxes, unintended net contacts, and landing/clearance failures block a preset from shipping. |
| BALL-07 | Apply configurable physical wind. | Direction and speed produce deterministic world-space air velocity; drag and Magnus use air-relative velocity, non-zero side wind measurably shifts the bounce, and calm-air results remain compatible. |
| BALL-08 | Configure physical landing interactively. | Right-click, hold, and drag directly on the FPV court to change shot azimuth; launch speed, spin rate, landing depth, and the profile safety constraint determine the solved elevation and first bounce. |
| BALL-14 | Inspect derived physics on demand. | With Trajectory enabled, hovering any rendered path segment shows the interpolated time/height/speed plus launch, spin, angle, apex, net, landing, bounce, and arrival metadata in the scene; leaving the path removes it. |
| BALL-09 | Preserve the complete post-bounce simulation. | Receiver-plane or baseline crossing does not terminate samples; the trajectory and each launched ball remain active through at least three seconds after first ground contact, including when launch intervals overlap. |
| BALL-10 | Keep Quick Practice shot and spin choices physically compatible. | Groundstroke exposes Flat drive/topspin/slice; Flat drive means bounded low topspin rather than zero spin. Serve exposes flat/slice/kick from serve contact height into the diagonal service box, an explicitly selected Volley shot moves the opponent near the net and is spin-free, and lob exposes flat/topspin/slice on a high arc for Overhead practice. The Volley rail preset instead combines the net camera with a behind-baseline Groundstroke feed for the user to volley. |
| BALL-11 | Separate perceptual bounce adjustment from natural surface physics. | A 0.60×–1.40× first-bounce-height factor defaults to 1.00×, affects only the first post-impact normal velocity, persists locally, and leaves launch, pre-bounce flight, landing, wind, and the selected surface profile unchanged. |
| BALL-12 | Configure landing depth independently from pace and net clearance. | Non-serve practice exposes a persisted target measured from the net; the fixed-speed solver searches legal launch angles that clear the requested minimum and reports the closest physically reachable depth when no exact solution exists. |
| BALL-13 | Support an incoming lob for overhead rehearsal. | Lob is a first-class Quick Practice type with a high-angle branch, distinct contact/opponent defaults, 1.20–6.00 m clearance range, compatible flat/topspin/slice choices, and a deep default first bounce. |

### 9.4 Opponent and serve motion

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| OPP-01 | Cover all V1 stroke families on a compatible rig. | Every shipped family loads and blends without visible pose jumps at normal speed. |
| OPP-02 | Synchronize racket contact and launch. | Every stroke exposes a contact marker; launch occurs at that simulation timestamp without a visible ball/racket gap. |
| OPP-03 | Position and recover credibly. | Footwork/root motion reaches the authored contact point and returns or advances according to the sequence. |
| OPP-04 | Ship both opponent hands. | All required drill families work with a left- and right-handed opponent; each mirrored use has a recorded acceptance review. |
| OPP-05 | Ship normal and compact serves. | Both rhythms have distinct toss/loading/contact timing, remain readable at normal speed, and can drive the same legal ball-pace preset. |
| OPP-06 | Preserve readable preparation. | Preparation and contact timing are authored independently of ball flight speed and expose valid playback-rate bounds. |
| OPP-07 | Position the opponent across the playable floor envelope. | Quick Practice and editor events share player-view-correct position presets, including a regular Rally origin 1.0 m behind the far baseline and deuce/ad serving positions. Free dragging and imported event positions are bounded by the ITF international-competition runoff: 6.40 m behind baselines and 3.66 m beyond doubles sidelines. |

### 9.5 Drills, timeline, and local content

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| DRILL-01 | Repeat single shots and work/rest sets. | Repetition, interval, block, pause, and restart work without reloading already cached assets. |
| DRILL-02 | Coordinate ordered sequences. | Opponent, ball, camera, cue, and rest events share one deterministic timeline. |
| DRILL-03 | Randomize only declared parameters. | The same seed reproduces the same session; every value remains within author bounds. |
| DRILL-04 | Cover every V1 family. | Bundled content includes baseline alternation/depth, serve recognition, tactical transition, serve-and-volley, two-volley, lob/overhead, and moving recovery patterns. |
| DRILL-05 | Make trajectory guidance explicit. | One trajectory toggle controls the predictive line in setup and playback without introducing a second practice-mode concept. |
| DRILL-06 | Author locally. | The timeline editor validates compatible opponent clips, ball contacts, camera paths, rest/cues, and asset availability before playback. |
| DRILL-07 | Exchange drills safely. | Versioned JSON export/import rejects unknown incompatible schemas and never executes code or remote references. |
| DRILL-08 | Reuse offline. | The app explains which content is cached, launches cached drills offline, and reports missing optional assets clearly. |

### 9.6 Camera movement

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| CAM-01 | Animate player-position changes. | Paths specify position, look/orientation, duration, easing, and speed limits independently from ball simulation. |
| CAM-02 | Cover baseline-to-net movement. | Bundled paths include lateral baseline recovery, advance/retreat, approach, first/second volley, and overhead repositioning. |
| CAM-03 | Protect visual comfort. | Every moving path has conservative acceleration and a reduced-motion cut/gentle alternative; no head bob is required. |
| CAM-04 | Allow preference adjustment. | Users can scale or disable translation and rotation intensity without editing ball or opponent timing. |

## 10. Shot and drill taxonomy

Each reusable shot describes independent axes:

- **Source:** serve, forehand, one-handed backhand, two-handed backhand, approach, volley, half-volley, lob, overhead.
- **Opponent hand:** left or right.
- **Serve rhythm:** normal or compact when source is serve.
- **Intent:** neutral, heavy/deep, short angle, approach, defensive height, pass, lob, volley setup, finish.
- **Direction:** near-left, middle/body, near-right plus tactical cross-court/down-line/inside-out/inside-in metadata.
- **Flight:** low/flat, medium, high/heavy.
- **Spin:** shot-aware rather than one mixed list—groundstrokes and lobs allow flat/topspin/slice, serves allow flat/slice/kick, volleys are spin-free, and authored specialist content may retain validated sidespin blends.
- **Pace:** beginner, club, advanced, elite-inspired, or explicit launch-speed range.
- **Frequency:** fixed interval, work/rest cadence, or declared bounded timing variation.
- **Landing:** named normalized zone plus exact coordinates.
- **Arrival:** bounce height/window and time from bounce to receiver plane.

## 11. Core user flow

1. Open the public app and choose the **Rally**, **Return**, **Volley**, or **Overhead** setup preset.
2. Combine a camera-position preset with a perspective preset, optionally use camera-relative WASD plus Ctrl+W/S height movement or physical display measurements, and confirm a clear area.
3. Configure launch speed, spin, landing depth, interval, trajectory visibility, repetitions, opponent position/hand, and venue in collapsible sections.
4. Use the court plans to position the opponent or steer a physically resolved landing if desired.
5. Enter full screen, receive a countdown, and run the set.
6. Pause immediately at any time.
7. Review the completed repetitions and configuration, then replay with the same seed, randomize, edit, or export the drill. V1 does not grade the player's body.

## 12. Tactical content examples

### Baseline transition

1. Two opponent forehands cross-court to the same near-court side, with the second deeper.
2. Opponent forehand down the line to the opposite near-court side.
3. Opponent backhand cross-court.
4. Short finishing ball; camera advances using the selected comfort profile.

### Return recognition

1. Deuce-court flat serve to the T.
2. Deuce-court slice serve wide.
3. Ad-court kick serve high toward the near-right or near-left target, as authored.
4. Repeat with bounded location and pace variation, alternating normal and compact server rhythms where configured.

### Serve-and-volley rehearsal

1. Opponent serve visualization/return cue from the baseline camera.
2. Authored forward camera path to first-volley position.
3. First volley feed, recovery step, and second volley feed.
4. Lob recognition followed by a quick, comfort-bounded overhead reposition and smash feed.

## 13. Visual and audio direction

- Use a game-realistic style: physically credible court dimensions/material response and a realistic athlete silhouette/motion without requiring near-photoreal skin, hair, or cinematic rendering.
- Treat the venue as a complete game scene, while keeping detail, seating, props, and lighting restrained enough that the opponent and ball remain readable.
- Offer outdoor daylight/night and direction-controlled light plus indoor club-hall and stadium lighting identities; every scene material and prop remains compatible with these live controls.
- The ball may be visually enlarged slightly or receive a subtle contrast halo without changing collision radius.
- Opponent quality is judged first by preparation, foot plants, racket path, contact, recovery, and serve rhythm.
- Audio reinforces timing; crowd/venue ambience remains optional.

## 14. Safety, accessibility, and privacy

- Clear pause/exit behavior before controls hide; `Escape` behavior is explicit.
- Reduced camera motion, motion disable, mute, high-contrast ball, cue-volume controls, slow motion, visual countdown, and keyboard-only setup.
- Warn users to clear space and avoid a real racket near screens or people unless they have independently established a safe setup.
- Do not imply technique correctness, medical benefit, or injury prevention.
- V1 never requests camera permission. V2 must request it only when the user starts tracking, display capture state, and document processing/retention before release.

## 15. Non-functional requirements

| Area | Initial target |
| --- | --- |
| Performance | Stable 60 fps at 1920×1080 on the agreed reference mid-tier device; adaptive pixel ratio at 1440p/4K. Optional 90/120 fps only after an on-device benchmark. |
| Frame pacing | Fixed simulation clock and render interpolation; no outcome change across supported refresh rates. |
| Startup | Cached shell opens immediately; first useful drill target is under 5 seconds on the reference network/device. Final byte and timing budgets are set by the vertical slice. |
| Asset delivery | Critical code-owned court/UI first; the neutral opponent and animation bundles lazy-load as optimized rights-cleared GLB. Scene geometry and local procedural textures remain versioned application modules without a splat/world payload. |
| Compatibility | Current Chrome and Edge on Windows primary; current Safari on macOS and Firefox on Windows validation; WebGL 2 minimum fallback. |
| Offline | App shell and user-selected cached content work without a network after a successful initial load. |
| Resilience | Renderer/asset failures identify the missing capability or asset and preserve setup/navigation. |
| Determinism | Same app/solver/content version plus seed produces the same trajectory and event times. |
| Testing | Numerical goldens, timeline tests, asset validation, browser interaction tests, performance evidence, and representative visual regression. |
| Maintainability | Rendering, simulation, timeline, assets, editor, and React UI communicate through typed versioned boundaries; React never owns frame-by-frame simulation. |

## 16. V1 release criteria

- Every V1 must-have and acceptance criterion has recorded evidence on the release matrix.
- Bundled content includes at minimum 12 groundstroke/trajectory presets, 8 serves spanning both motion rhythms and both opponent hands, 4 net/overhead feeds, 4 baseline/return drills, and 4 tactical patterns including serve-and-volley and overhead movement.
- Both opponent hands and both serve rhythms pass normal-speed and frame-step contact review.
- Every shot records net clearance, landing error, bounce state, receiver-plane arrival, and deterministic replay evidence.
- The local timeline editor can create, validate, replay, export, and re-import one drill from each major content family.
- Offline launch of at least one user-selected drill passes after network removal.
- 30-minute mixed-session soak has no unbounded memory growth, lost timeline state, or material frame-rate degradation.
- Calibration and core drill flow pass observed testing with the owner, at least one coach, and at least three additional target players across more than one skill level.
- Safety, accessibility, asset-license/provenance, privacy, browser fallback, and public-hosting reviews are complete.
- Visual concept-to-browser fidelity and actual large-display reviews are accepted.
- All six venue identities load, preserve regulation gameplay geometry, and meet their documented atmosphere, shader-material, fixture-alignment, and opponent/ball-readability criteria.

## 17. Success measures

V1 measures usefulness without pretending to measure swing quality:

- Time to first repetition and setup completion in moderated tests.
- Correct recognition of direction, length, serve family, and normal versus compact rhythm.
- Player/coach ratings for timing credibility, ball readability, camera comfort, and tactical usefulness.
- Percentage of sessions that maintain target frame pacing and complete without an asset/runtime error.
- Repeat use of saved/custom drills, measured locally unless analytics is separately approved.

## 18. Confirmed assumptions and remaining choices

Confirmed product decisions are recorded in [ADR-0002](decisions/0002-v1-scope-and-release-model.md). Remaining implementation and commercial questions are maintained in [Open questions](open-questions.md). The asset path is deliberately not locked until the comparison in [AI 3D asset and animation tools](research/ai-3d-asset-tools-2026.md) is run against tennis-specific acceptance footage.
