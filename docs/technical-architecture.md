# Architecture

Tenmulate is a static React/TypeScript/Vite application with a Three.js WebGL 2
renderer. React owns configuration and low-frequency UI state; session planning,
physics and the simulation clock supply playback. There is no runtime database,
account service, body tracking or motion-inference service.

## Ownership and data flow

| Area | Authority |
| --- | --- |
| Routes and configuration | `src/app/`, `src/components/`, `src/hooks/` |
| Authored drills, shots and defaults | `src/content/` |
| Court, camera and environment definitions | `src/domain/` |
| Trajectories and court collision | `src/engine/trajectory/` |
| Contact planning, recovery and session compilation | `src/engine/session/` |
| Scene, opponent rig and rendering | `src/engine/rendering/` |
| Sound palette, events and mixing | `src/engine/audio/` |
| Saves, migrations and draft recovery | `src/storage/` |
| Fixed UI and built-in content translations | `src/i18n/` |

`SharedCourtProvider` owns a persistent canvas/scene across setup, editor and
playback. Routes supply viewport slots rather than recreating the renderer.
Parking the court or hiding the document suspends work. Editing a zone previews
the gesture and commits its rectangle on release; cancelled gestures restore it.

## Session planning

Quick Practice compiles incoming feeds and illustrative returns. Player-first
drills assemble openings, player contacts, opponent responses and camera events.
Both use physical trajectories and a shared movement/recovery planner. Ball pace
is independent of animation rhythm. Contact timing must satisfy the appropriate
bounce, height and travel constraints; infeasible authored setups report a problem
rather than fabricating a connection.

Seeded variation searches feasible candidates instead of stopping at the first
unsolvable random sample. Opponent contacts must be reachable while grounded;
where appropriate the planner waits for a later descending intercept rather than
lifting the model. Serve jumps remain part of the authored motion. Opening serves
preserve the authored receiving camera and incoming pace, including variation.

Workers keep expensive compilation off the UI thread. Exact-input caches and
in-flight deduplication let preview/configuration work prepare launch sessions.
Cancellation belongs to each subscriber; stale results cannot replace new input.
Continuous setup previews request future batches, while launched sets are finite
and honor repetitions/rest. Start detaches the old preview and resets the new
session clock before playback; unfinished calculations can still take time.

## Court and physics

Court-domain constants use metres and seconds. The net centre is the origin;
`y` is up and positive `z` points toward the opponent. The renderer and physics
share court coordinates. Moving the camera changes the virtual receiving position,
not the dimensions of the court or the ball's world-space trajectory.

The numerical flight model includes gravity, drag and spin-dependent lift.
Inverse solving fits a trajectory to the landing zone and shot constraints.
Natural and exact parameter modes retain distinct constraints. Player and
opponent balls use the same court-bounce response. Bounce factor is a practice
adjustment, not a ball-pressure measurement or a fixed rebound-height ratio.

### Calibration references and limits

The model is a rehearsal approximation, not an individualized biomechanics model
or a measured reconstruction of a particular venue. The following sources inform
calibration; their observations do not validate every simulation setting.

- [ITF technical booklet](https://www.itftennis.com/media/15639/2026-technical-booklet.pdf):
  reference ball-drop and court-testing methods. Reference-drop and angled court
  impacts are different checks.
- [Cross: Measurements of the horizontal and vertical speeds of tennis courts](https://www.physics.usyd.edu.au/~cross/PUBLICATIONS/23.%20CourtSpeed.PDF)
  and [Measurement of the speed and bounce of tennis courts](https://www.physics.sydney.edu.au/~cross/PUBLICATIONS/52.%20SpeedAndBounce.pdf):
  oblique restitution, grip and spin inform the coupled translation/spin response
  in `courtBounce.ts`; surface parameters remain representative calibrations.
- [Armstrong et al.: Lateral End-Range Movement Profile and Shot Effectiveness](https://pmc.ncbi.nlm.nih.gov/articles/PMC11730432/)
  and [Filipcic et al.: Split-Step Timing of Professional and Junior Tennis Players](https://pmc.ncbi.nlm.nih.gov/articles/PMC5304278/):
  movement and response-time context for the `playerCoverage.ts` heuristic.
  Professional observations are not a guarantee of recreational-player reach.

Coverage uses response delay, acceleration, speed and racket reach, constrained
by legal contact height and bounce timing. Its numerical assumptions live in
`PLAYER_COVERAGE`; they are not inferred from the viewer. An incoming ball can be
reachable while the subsequent return connection remains infeasible.

## Motion and assets

The active opponent model and motion manifests are
[`opponent-asset.json`](../src/content/opponent-asset.json) and
[`opponent-motion.json`](../src/content/opponent-motion.json). The renderer consumes
versioned GLB assets with source clocks, contact anchors and phase metadata.
Racket grip, anatomical lengths, floor contact and handedness must remain valid
after blending, world travel and IK. Runtime checks complement rendered review.
Only the active opponent bundle is precached; detailed attribution belongs in
[asset attribution](asset-attribution.md), not a duplicate asset-hash ledger.

Six authored venue environments provide quality/performance variants. Court
geometry, ball state, targets and gameplay collision remain engine-owned.
Ball highlight affects ball materials rather than adding scene blur.

## Sound and capture

A shared Web Audio graph follows simulation events. A bounded decoded palette
supplies recorded contacts/crowds and synthesized bounces/environment layers.
Twelve recorded forehand/serve/slice contacts use seeded selection with recent-take
avoidance. Volley/drop-shot and overhead mappings are authored approximations.
Contact bytes load from a lazy application chunk; other palette assets use static
media delivery. The procedural fallback is distinct from recorded playback.

Venue responses shape reflections and ambience; they are not measured building
acoustics. Category levels, crowd enable and master mute share one visit-scoped
mix across setup and playback. Pausing, hiding or leaving a preview releases/fades
its sound without inventing impacts or changing ball timing.

Court capture reuses the canvas and post-effects audio mix across routes, with a
720p drawing-buffer budget and 30 fps ceiling. This local media stream is separate
from TV transport. Screen mirroring remains a device/receiver function.

## Persistence, localization and delivery

Production saves use versioned browser localStorage. Explicit configs are stored
per Quick Practice mode; unfinished editor drafts are separate from saved drills.
Saved browser overrides take precedence over bundled defaults. Reset config
restores the mode defaults without deleting overrides; saving explicitly replaces
them. Project-file writes are restricted to Vite development middleware and are
absent from the deployed application. There is no silent destination fallback.

English/Simplified Chinese fixed UI and built-in content share stable identities.
User-authored names, descriptions and cues are never translated automatically.

Vite produces static files with a service worker for cached/offline reuse. Runtime
assets and their cache policies are versioned; uncached resources need a network.
Build and delivery commands live in [AGENTS.md](../AGENTS.md). Device and broader
acceptance limits are tracked in [open work](open-questions.md).
