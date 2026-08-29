# Product requirements: first-person tennis simulation

- **Status:** Draft
- **Working title:** Tenmulate
- **Last updated:** 2026-08-29
- **Target release:** V1 shadow-swing visualization

## 1. Product summary

Tenmulate is a browser-based tennis rehearsal tool viewed on a large screen or projector. It presents an on-court, first-person view of an opponent and realistic incoming balls so a player can shadow-swing, rehearse recognition, and mentally model point patterns without a racket rendered in the foreground.

The V1 product is a visualization and rehearsal system. It does not attempt to detect whether the player moved correctly, score technique, replace a coach, or act as a full tennis game.

## 2. Problem

Tennis players can understand a tactical pattern verbally yet struggle to rehearse its timing, spacing, and visual cues away from court. Ordinary match video fixes the camera outside the player's perspective, while conventional games prioritize controller input and entertainment. The product needs to reproduce the perceptual problem a player sees—opponent preparation, ball flight, bounce, and arrival—from a consistent player-eye perspective.

## 3. Goals

1. Make incoming direction, depth, height, speed, spin, bounce, and post-bounce approach visually legible from a believable player POV.
2. Let a user start a useful baseline or return-of-serve rehearsal in under one minute.
3. Support deterministic, repeatable drills and tactical sequences.
4. Keep the active rehearsal view visually quiet: court, opponent, ball, restrained cues, and no foreground avatar or racket.
5. Establish an asset and simulation foundation that can later accept body tracking without coupling V1 to a camera or backend.

## 4. Non-goals for V1

- User body, racket, or swing tracking.
- Technique grading, automatic scoring, or coaching claims.
- Multiplayer, online opponent AI, or real match rules/scoring.
- A first-person racket, hands, arms, or user avatar.
- Procedurally intelligent point construction during playback; V1 sequences are authored presets.
- Photorealistic digital humans as a release requirement.
- Accounts, social features, cloud synchronization, payments, or a content marketplace.
- Native mobile, VR, or AR applications.

## 5. Primary users and contexts

### 5.1 Primary user

An adult or junior tennis player who knows basic forehand/backhand preparation and wants off-court perceptual or tactical rehearsal. Skill level is currently an open product decision; the provisional design supports configurable beginner-to-advanced speeds.

### 5.2 Secondary user

A coach selecting a drill for one player or a small group and controlling speed, handedness, target zones, repetition count, and rest timing.

### 5.3 Expected environment

- Large TV, monitor, or projector.
- Modern desktop/laptop browser, preferably full screen.
- User stands far enough from the screen to swing safely.
- Keyboard, mouse, touchpad, or simple remote-like controls before the set begins; minimal interaction during a set.

## 6. Product principles

1. **Perceptual truth before decorative realism.** Correct timing, scale, contact, bounce, and readable ball motion matter more than stadium detail.
2. **Calibrated POV.** The user's eye height, virtual baseline offset, physical display size, and viewing distance should produce a defensible field of view.
3. **Quiet during motion.** Configuration UI recedes during a repetition. Important cues use sound, brief countdowns, or peripheral indicators without covering the ball.
4. **Predictable repetition.** Seeded variations and exact replay let players progress from blocked practice to variable practice.
5. **Safe by construction.** Every session includes a space reminder, immediate pause, reduced-motion options, and conservative default camera acceleration.
6. **Local and private by default.** V1 does not require a camera or account.

## 7. V1 scope

### 7.1 Must have

- A standards-dimension singles court and net with selectable hard/clay/grass-inspired visual themes.
- Eye-height POV positioned 1–2 m behind the center of the near baseline by default.
- Display/viewing-distance calibration, player eye-height setting, dominant-hand setting, and full-screen mode.
- Groundstroke shots to forehand, body, and backhand zones with configurable speed, height, depth, spin family, and bounce point.
- Cross-court, middle, and down-the-line patterns from multiple opponent contact positions.
- Opponent idle, recovery, forehand, backhand, and serve animations synchronized to ball contact.
- Flat, slice, and kick/topspin serve families landing in valid deuce/ad service-box zones and continuing after the bounce toward the returner.
- A preset drill player with countdown, repetition count, interval, pause/resume, restart, and randomization within explicit bounds.
- At least one tactical baseline sequence and one serve-return sequence.
- Optional pre-shot trajectory preview for learning mode; hidden by default in rehearsal mode.
- Ball-contact, bounce, and optional footwork cue audio with independent volume controls.
- Stable 60 fps target on the agreed reference device at 1080p, with adaptive quality for larger resolutions.

### 7.2 Should have

- Camera presets for center, forehand corner, and backhand corner, plus short forward/back recovery paths.
- Slow-motion playback and exact replay.
- Left- and right-handed opponent variants through animation mirroring or distinct clips where mirroring is biomechanically misleading.
- A coach/debug overlay showing launch speed, spin, net clearance, landing coordinates, bounce speed, and arrival time.
- Local custom drill composition from existing validated shots.
- Offline reuse after the first load if asset size and browser caching prove practical.

### 7.3 Could have in V1.1

- Serve-and-volley, first/second volley, approach, and overhead-smash sequences.
- A timeline-style drill editor with camera and opponent tracks.
- Multiple opponent appearances and venue ambience.
- Export/import of a shareable drill JSON file.
- Optional 90/120 fps mode on capable displays.

### 7.4 Explicitly later

- Camera-based pose and swing recognition.
- Automatic movement of the virtual camera based on detected user movement.
- Technique feedback, achievement systems, cloud drill libraries, and collaborative coaching.

## 8. Functional requirements

### 8.1 Setup and calibration

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| CAL-01 | Set display diagonal or physical width/height and viewing distance. | The app derives and shows the physical-view vertical and horizontal FOV and lets the user compare it with an immersive override. |
| CAL-02 | Set eye height and virtual position behind/across the baseline. | Court scale and horizon update without changing court dimensions. Defaults are 1.70 m eye height and 1.5 m behind baseline. |
| CAL-03 | Select dominant hand. | Forehand/backhand labels, target zones, and relevant preset descriptions switch consistently. |
| CAL-04 | Run a visual scale check. | A court-width/net-height calibration screen can be revisited at any time. |
| CAL-05 | Confirm a clear practice area. | The first session on a device presents a short safety acknowledgement; it does not claim to measure the space. |

### 8.2 Court and point of view

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| POV-01 | Render regulation geometry in SI units. | Singles width is 8.23 m, full length 23.77 m, service line distance is 6.40 m from the net, and net height is 0.914 m at center and 1.07 m at posts. |
| POV-02 | Support court visual themes independently of physics. | Changing colors/material textures cannot silently change bounce behavior; surface physics is a separate labeled control. |
| POV-03 | Keep the near-player body and racket absent. | No foreground limb, racket, or swing animation appears during V1 playback. |
| POV-04 | Provide full-screen rehearsal. | Controls can be hidden, restored with a single action, and remain keyboard accessible. |

### 8.3 Ball simulation

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| BALL-01 | Model gravity, quadratic drag, and spin-dependent Magnus lift in three dimensions. | Flat, topspin/kick, slice, and sidespin test trajectories match recorded golden samples within agreed numerical tolerances. |
| BALL-02 | Model court impact separately from free flight. | Surface profiles affect normal restitution, horizontal velocity loss, and spin coupling; every shot reports pre/post-bounce velocity. |
| BALL-03 | Author by meaningful outcomes. | A shot can be specified by contact point, target landing zone, desired speed/spin family, and post-bounce intent instead of raw vectors alone. |
| BALL-04 | Prevent tunneling and timing drift. | A fixed-step solver detects the first court/net event between render frames; 30, 60, and 120 Hz rendering produce the same outcome. |
| BALL-05 | Make high-speed balls visible without falsifying their path. | Motion blur/trail treatment is optional and bounded; the debug path always shows the computed centroid trajectory. |
| BALL-06 | Validate tennis legality. | Presets fail authoring validation if they miss the intended court/service zone, hit the net unintentionally, or violate defined clearance constraints. |

### 8.4 Opponent and contact synchronization

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| OPP-01 | Play forehand, backhand, serve, idle, split-step, and recovery clips. | Required clips load from one compatible rig and blend without visible pose jumps at normal playback speed. |
| OPP-02 | Synchronize racket contact and ball launch. | Every stroke clip exposes a contact marker; ball motion begins on that simulation timestamp with no visible gap from the racket. |
| OPP-03 | Position the opponent for the shot. | Footwork/recovery and root motion place the character at the authored contact location before the launch event. |
| OPP-04 | Preserve readable preparation. | A shot's preparation and contact timing can be authored independently of ball flight speed so rhythm remains believable. |

### 8.5 Drills and sequences

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| DRILL-01 | Play a single shot repeatedly. | User can choose repetitions and rest interval, then pause/restart without reloading assets. |
| DRILL-02 | Play an ordered sequence. | A sequence coordinates opponent position/clip, ball, camera path, and rest events on one deterministic timeline. |
| DRILL-03 | Randomize within safe bounds. | Seeded variation changes only declared values and exact replay with the same seed is identical. |
| DRILL-04 | Ship useful presets. | Initial content includes forehand/backhand alternation, deep/short recognition, serve location recognition, and one five-ball tactical pattern. |
| DRILL-05 | Separate learning and rehearsal modes. | Learning may show target/trajectory cues and slow motion; rehearsal removes predictive cues and uses match-like timing. |

### 8.6 Camera movement

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| CAM-01 | Animate player-position changes. | Camera paths specify position, look target/orientation, duration, and easing independently from ball simulation. |
| CAM-02 | Protect visual comfort. | Defaults avoid abrupt yaw/acceleration; a reduced-motion setting replaces continuous travel with cuts or gentler transitions. |
| CAM-03 | Keep court coordinates authoritative. | Moving the camera never changes shot landing coordinates or timing. |

## 9. Initial shot taxonomy

Each reusable shot is described along independent axes:

- **Source:** serve, forehand, one-handed backhand, two-handed backhand, volley, overhead.
- **Intent:** rally neutral, heavy/deep, short angle, approach, defensive height, finish.
- **Direction:** cross-court, middle/body, down the line, inside-out, inside-in.
- **Flight:** low/flat, medium, high/heavy.
- **Spin:** flat, topspin, backspin/slice, kick, sidespin blend.
- **Pace:** beginner, club, advanced, elite-inspired, or explicit launch-speed range.
- **Landing:** normalized named zone plus exact court coordinates.
- **Arrival:** bounce height/window and time from bounce to receiver plane.

This prevents a preset name such as “fast forehand” from hiding the values that actually determine the experience.

## 10. Core user flow

1. Open the app and choose **Quick Rally**, **Return Practice**, **Tactical Pattern**, or **Custom**.
2. On first use, enter display/viewing setup, eye height, dominant hand, and safe-space confirmation.
3. Choose difficulty, surface physics, repetition count, and learning/rehearsal mode.
4. Preview the first shot from a paused court if desired.
5. Enter full screen, receive an audio/visual countdown, and run the set.
6. Pause at any time with one large action/key.
7. Review a compact summary: completed repetitions, selected drill, pace range, and replay/customize actions. V1 does not grade the user's body.

## 11. Tactical content examples

### Baseline pattern A

1. Opponent forehand cross-court to user's forehand.
2. Opponent forehand cross-court to user's forehand with greater depth.
3. Opponent forehand down the line to user's backhand.
4. Opponent backhand cross-court to user's backhand.
5. Short ball to user's forehand finishing zone; camera advances conservatively.

### Return pattern A

1. Deuce-court flat serve to the T.
2. Deuce-court slice serve wide.
3. Ad-court kick serve high toward the backhand.
4. Seeded repeat with location jitter inside declared service-box subzones.

## 12. Visual and audio direction

- Favor a clean training environment over a crowded broadcast stadium.
- Use realistic court proportions, readable depth cues, contact shadows, and restrained lighting.
- The ball must remain identifiable against all court/venue themes; accessibility options may enlarge the rendered ball slightly or add a subtle high-contrast halo while preserving its physical collision radius.
- Opponent fidelity can be stylized-realistic in V1 if stroke silhouette, foot plant, racket path, and contact timing are credible.
- Audio should reinforce timing: opponent contact, court bounce, shoe/footwork cue, countdown, and pause. Crowd ambience is optional and off by default.

## 13. Safety, accessibility, and privacy

- Always-visible pause affordance before full-screen controls hide; `Escape` exits/pause behavior must be clear.
- Reduced camera motion, mute, high-contrast ball, adjustable cue volume, slow motion, captions/text equivalents for countdowns, and keyboard-only setup.
- Warn users to maintain clear space and avoid swinging a real racket near screens or people unless they have independently established a safe setup.
- Do not imply injury prevention, technique correctness, or medical benefit.
- V1 uses no camera. A future tracking mode must request permission only when explicitly started, process locally by default, and clearly show when capture is active.

## 14. Non-functional requirements

| Area | Initial target |
| --- | --- |
| Performance | Stable 60 fps at 1920×1080 on the agreed reference laptop; adaptive pixel ratio at 1440p/4K. |
| Frame pacing | Fixed simulation clock; render interpolation; no outcome change across supported refresh rates. |
| Startup | First useful preset starts within 5 seconds on the reference device/network after cached app shell; final budget set by spike. |
| Compatibility | Current Chrome and Edge on Windows are primary; current Safari on macOS and Firefox on Windows are validation targets; WebGL 2 is the minimum fallback. |
| Resilience | Clear fallback screen if no renderer can initialize; asset errors identify the missing asset and preserve navigation. |
| Determinism | Same version + shot definition + seed yields the same trajectory samples and event times. |
| Testing | Numerical golden tests, sequence/event tests, asset validation, browser interaction tests, and representative visual regression. |
| Maintainability | Rendering, simulation, timeline, assets, and React UI communicate through typed boundaries; no frame-by-frame React state updates. |

## 15. V1 release criteria

- All must-have requirements pass on the reference device and browser matrix.
- At least 12 validated single-shot presets, 4 serve presets, 4 baseline drills, and 2 multi-shot tactical patterns.
- Each shot has recorded net clearance, landing error, bounce outcome, receiver-plane arrival, and deterministic replay evidence.
- Opponent contact synchronization passes frame-by-frame review for every shipped stroke family.
- 30-minute rehearsal soak has no unbounded memory growth, lost animation state, or material frame-rate degradation.
- First-use calibration and core drill flow pass an observed test with at least one coach and three target users, subject to owner approval of the research plan.
- Safety, accessibility, asset license, and privacy checks are complete.
- Visual concept-to-browser fidelity review is complete before release polish is accepted.

## 16. Success measures

V1 success should measure usefulness without pretending to measure swing quality:

- Setup completion rate and median time to first repetition (if analytics are explicitly approved; otherwise measured in moderated tests).
- Percentage of test users who correctly identify direction/length/serve family above a defined threshold.
- User-rated timing, scale, and bounce credibility.
- Repetition completion and voluntary replay/customization in user tests.
- Renderer stability and frame-time percentiles on the supported hardware matrix.

## 17. Assumptions requiring confirmation

The draft assumes a desktop/laptop connected to a large display, single-player home or coaching use, local-first data, no V1 camera, and a stylized-realistic opponent. The priority questions and recommended defaults are in [Open questions](open-questions.md).
