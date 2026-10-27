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
The top-down player-camera marker follows the same commit-on-release contract.
It edits the authored position and yaw, independently of the temporary overhead
view; it preserves eye height, pitch and field of view.

## Session planning

Quick Practice compiles incoming feeds and illustrative returns. Player-first
drills assemble openings, player contacts, opponent responses and camera events.
Both use physical trajectories and a shared movement/recovery planner. Ball pace
is independent of animation rhythm. Contact timing must satisfy the appropriate
bounce, height and travel constraints; infeasible authored setups report a problem
rather than fabricating a connection.
Standalone Quick Rally responses are solved only at set endings or failed links;
connected exchanges supply their own return. Seeded target draws retain their
original order even when a discarded standalone solve is skipped.

Seeded variation searches feasible candidates instead of stopping at the first
unsolvable random sample. Opponent contacts must be reachable while grounded;
where appropriate the planner waits for a later descending intercept rather than
lifting the model. Serve jumps remain part of the authored motion. Opening serves
preserve the authored receiving camera and incoming pace, including variation.

Workers keep expensive compilation off the UI thread. Exact-input caches and
in-flight deduplication let preview/configuration work prepare launch sessions.
Cancellation belongs to each subscriber; stale results cannot replace new input.
Continuous setup previews request future batches, while launched sets are finite
and honor repetitions/rest. Finite compilers publish an opening buffer before
finishing the session: two Quick Practice repetitions or one connected player event,
with additional lookahead retained behind an immutable playback boundary. Short
sessions can finish outright. Quick Practice prepares physics incrementally;
seeded return targets are drawn in their original order before linking starts.
The worker extends that same solve instead of recompiling shortened sessions.

Start subscribes before stopping preview/warmup subscriptions and transfers its
worker ownership to rehearsal. Preview readiness is not a launch gate. Edits
before entry cancel the captured launch; exiting rehearsal cancels unfinished
work. Only complete, valid sessions enter the completed cache. Later planning
failures pause playback with an error rather than presenting a truncated success.

The playable boundary excludes recovery toward an unfinished opponent stroke and
unfinalized camera exchanges. Appending results preserves the simulation clock,
renderer state and audio cursor. If playback catches up, the clock and audio
pause until more validated content arrives; an explicit user pause stays paused.
Seeks are clamped to the prepared buffer. Camera-motion controls rescale the
timeline without recompiling physics, and new variations also compile off-thread.

Quick Practice presents reps per set and set count, deriving the total for the
compiler and existing browser/project save format (`repetitions`, `workBlockSize`).
Legacy partial final sets retain their total until a set-size/count edit. Set
sliders commit on release so dragging does not repeatedly restart compilation.

## Court and physics

Court-domain constants use metres and seconds. The net centre is the origin;
`y` is up and positive `z` points toward the opponent. The renderer and physics
share court coordinates. Moving the camera changes the virtual receiving position,
not the dimensions of the court or the ball's world-space trajectory.

The numerical flight model includes gravity, drag and spin-dependent lift.
Inverse solving fits a trajectory to the landing zone and shot constraints.
The hot first-flight inverse probe keeps its integration state in scalar locals
using the same fixed step, drag, spin decay and lift equations as the sampled
forward model. It preserves the search order and physical acceptance checks.
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

## Local video comparison

`src/video-comparison/` owns a separate, lazily loaded review surface. A disposable
worker reads local File objects with Mediabunny and indexes video presentation
timestamps without decoding the video or uploading bytes. Frame rate is measured
from those timestamps; variable-rate clips retain their individual frame spacing.
Indexes are bounded to one million frames per clip. Twelve small local thumbnails
per clip form the overview lane, independently of the review video element.

Contact alignment maps comparison time to source time as
`source = contactTimestamp + comparisonTime * clipSpeed`. Frame stepping uses
actual presentation boundaries; the shared step chooses the next/previous boundary
across all clips. Playback uses one wall clock with muted native video followers,
per-clip playback rates and drift correction. Buffering pauses the group; clips
outside their source range hold an edge frame. Native browser decoding/display is
best effort during playback, not a hardware frame-lock guarantee.

Clips and alignment settings live only in memory for the current app visit. The
comparison surface remains mounted across navigation but pauses when hidden.
Removing a clip or unmounting the app cancels indexing/thumbnail work, releases
video decoders and revokes object URLs. No footage or derived frames enter saves,
project-file middleware, service-worker caches or a remote service.

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

## Storage ownership and lifecycle

| Location | Role and retention |
| --- | --- |
| `src/`, `server/`, `scripts/`, `docs/` | Application logic, authored content and contracts retained in Git. |
| `assets/` | Venue Blender masters, textures, audience sources and provenance. Excluded from Vercel upload, but present in Git checkouts; ignored Blender backups can also live here. |
| `public/assets/` | Static delivery. Vite copies every file into `dist/`, including historical opponent bundles excluded from precache. |
| `artifacts/venue-build/` | Reproducible raw exports alongside historical models, validation records and visual evidence. These have different retention requirements. |
| `artifacts/character-source/` | Pinned source archive, extracted model, character masters and earlier evidence. The character builder reads the selected source model and the neutral rig in `public/assets/opponents/`. |
| `.tools/` | Installed Blender and its bridge; shared with the sibling laboratory. Tool installation and active bridge processes are independent of the web app. |
| `node_modules/`, `dist/` | Reinstallable dependencies and generated deployment output. Asset-authoring dependencies currently share the frontend installation. |
| Sibling motion laboratory | Recipes, fitting, source previews, motion candidates, editable masters and named comparison baselines. Its ignored `work/` and `output/` are not disposable as a whole. |

Local workspace bytes, deployed bytes, browser storage and decoded CPU/GPU memory
are separate budgets. Removing local intermediates does not reduce frame time.
The service worker precaches only the selected opponent GLB; venues load on demand.
Venue caching permits twelve model responses for thirty days, while audience and
audio caches have their own limits. These are entry/age limits, not byte budgets.
Browser drill/configuration saves are separate from these replaceable asset caches.

Inactive venues release geometry, materials, textures and instance buffers. During
a quality replacement, the old model stays drawable while the new model downloads
and parses. The download path retains chunks and then assembles a contiguous
buffer, so switch-time memory can exceed steady-state model memory. Adaptive
resolution and performance variants already exist; profile their behavior before
changing the renderer.

Audio has a 32 MiB decoded-buffer limit with 4 MiB reserved for transitions and
resampling. Contact WAV bytes also appear in a lazy application chunk to avoid
browser media requests. The public WAVs remain authoring/verification inputs;
removing one representation requires updating those consumers.

Each session compiler retains three completed exact-input results and one idle
worker. Practice preview, practice launch and player drills have separate compiler
instances. This bounds result count per instance, not retained trajectory bytes or
the number of concurrent distinct jobs. Cancellation remains subscriber-owned.

Content-hashed publication updates selectors without retiring older public motion
bundles. Historical bundles can still support laboratory evidence. A delivery
allowlist and an explicit evidence archive would separate these responsibilities;
changing precache rules alone does not shrink a deployment. Removing a tracked
binary in a new commit also leaves its older versions in Git history.
