# Architecture

Tenmulate is a static React/TypeScript/Vite application with a Three.js WebGL 2
renderer. React owns configuration and low-frequency UI state; session planning,
physics and the simulation clock supply playback. There is no runtime database,
account service or remote motion-inference service. Optional pose and point analysis
runs locally in browser workers.

The URL owns the active section: `/quick-practice`, `/drills`, `/editor`, and
`/video-comparison`. Native navigation links preserve modified-click behavior;
`useAppRoute` uses history pushState/popstate without remounting the shared court
provider or an already opened comparison session. Route changes flush editor drafts
and cancel pending session launches. Root and trailing slashes canonicalize to a
section path. Vercel rewrites only these four paths to index.html; the service worker
uses the same bounded navigation fallback. Assets and venue-review retain their own
responses. Direct comparison entry avoids preloading the rehearsal runtime.

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

`src/video-comparison/` owns a separate review surface. Its lightweight shell is
bundled with navigation, so entering the page cannot suspend behind a codec download.
Playback decoders and the export dialog/encoders use separate dynamic imports,
requested on Play and Export respectively. Optional tool loads are cancellable at
the caller and time out after 20 seconds; late completion may populate the browser
module cache but cannot start canceled playback or reopen a closed dialog.
The playback clock starts only after its module is ready. A disposable
worker reads local File objects with Mediabunny and indexes video presentation
timestamps without decoding the video or uploading bytes. Frame rate is measured
from those timestamps; variable-rate clips retain their individual frame spacing.
Indexes are bounded to one million frames per clip. Twelve small local thumbnails
per clip form the overview lane, independently of the review video element. Up to
nine clips can be loaded. A zoomed lane debounces replacement thumbnails for its
visible source-frame interval and cancels obsolete work. Wheel/pinch zoom changes
only the view; pointer and keyboard range handles edit inclusive source indices.

Optional excerpt endpoints clamp every source-frame lookup. The shared range and
frame-boundary stepping use those endpoints, while contact timestamps stay absolute.
A contact excluded by an excerpt is intentionally not displayed; the nearest excerpt
edge holds instead. Crop rectangles are normalized in the oriented, unmirrored source.
Cards contain the cropped image using CSS; export clips the same normalized source
rectangle into a contained destination and mirrors it afterward. No source is modified.

`analysis/` adds opt-in, source-frame-indexed motion measurements. Selection points
and regions are normalized in the oriented, unmirrored source. A serialized queue
owns one disposable worker and one frame reader at a time. Cancellation aborts the
reader, closes samples, terminates inference and rejects stale commits through
per-clip tokens and per-track revisions. Jobs pause between frames during playback,
export, inactive routes and hidden tabs. No API/backend receives footage.

Point tracks require explicit start/end anchors on different source frames. Each
interval between manual corrections runs in both directions. The JSFeat tracker
uses nine-point pyramidal Lucas–Kanade flow checked by round-trip error. Translation
and similarity-transform proposals cover rotation/scale; weighted appearance matching
uses an immutable seed and two recent templates, updated only from unambiguous,
visually verified matches. Distinctive-color components add candidates for small balls
whose grayscale surroundings change. Search covers both the last observation and
prediction, so reversals are not excluded by the previous velocity. Expensive appearance
transforms run only around a few spatial proposals. Analysis stays at a 1280-pixel long
edge; reverse decoding retains four frames at a time. No new model download is required.

Each direction returns up to four spatial candidates rather than dropping every
ambiguous frame. A second-order, bounded beam selects a path from this evidence across
the range (24 states per observed frame), with exact manual anchors and robust motion
costs. Directional disagreement is resolved by the surrounding evidence, not by
discarding both matches or attracting points to an endpoint chord. A return-to-trend
filter rejects isolated bad matches while preserving visually supported multi-frame
loops. Sharp changes are inferred from stable incoming/outgoing velocities; contact
marks do not define motion boundaries and no turn annotations are required.

Only missing intervals need geometric reconstruction. Short gaps (up to 350 ms) use
observed endpoint tangents where available; longer gaps use explicitly uncertain
interpolation, which cannot recover unseen loops. A lightweight banded fit suppresses
small jitter but can move an observed position by no more than 0.75 source pixels;
manual positions and inferred sharp turns are unchanged. The trajectory, position
plots and exports use this same cached path. Inferred positions carry low confidence,
lighter solid trails, hollow markers and ≈ labels. No samples are extrapolated outside
the selected range. Continuity cannot prove target identity or recover hidden motion.

Round-trip proposal checks follow the
[OpenCV optical-flow example](https://github.com/opencv/opencv/blob/4.x/samples/python/lk_track.py).
Learned point trackers such as [CoTracker](https://github.com/facebookresearch/co-tracker)
remain possible research, but their supplied PyTorch/GPU pipeline is not a drop-in
replacement for this browser-only desktop/mobile budget.

A separate, opt-in pose worker loads a pinned MoveNet Lightning v4 graph through TFJS's single-thread WASM backend, avoiding WebGL contexts and cross-origin isolation. Worker entry points use static
runtime imports to avoid circular entry-module reinitialization in WebKit. It downsizes to a 640-pixel long edge, pads a moving crop to square and feeds
192×192 RGB. Every sample first inspects the full image, without user-region state.
Weak detections can retry automatically followed crops (at most three inferences
per sample), with torso center/scale gates for continuity. This is not persistent
person re-identification. Coordinates map back to the original source.
Draft samples at 15 Hz plus contact/end; full quality processes every source frame.
The worker finalizes observations before playback: unsupported one/two-detection
out-and-back excursions are rejected only with temporal support on both sides.
A separate repair pass interpolates missing joints relative to a visible parent
within 250 ms, or extrapolates limb offsets for up to 120 ms from two confident
observations. Estimates cannot seed more estimates; whole missing bodies and long
occlusions remain gaps. Unmodified observations (plus marked draft interpolation)
are retained for Raw plots.

Joint angles use confidence-weighted, source-time curvature regularization solved
with a banded Cholesky system in O(n) memory/time. A natural cubic curve through
those filtered angles supplies both angular derivatives, avoiding independent
finite differences of noisy keypoints. Degenerate projected limbs have no angle;
unsupported gaps split the curve. Endpoint accelerations are undefined rather than
reported as natural-boundary zeros. Isolated angle excursions are downweighted;
sustained changes and repeated turns are not capped by a fixed speed limit. The
worker precomputes all eight default 100 ms curves. Labels, default plots and exports
reuse those arrays; other plot windows use a cache keyed by series and frame index.
Estimated influence propagates to ≈ readouts. Skeleton estimates keep hollow/dashed
styling. All angles and full trajectory are on by default. Plot contact markers use
source timestamps independently of playback rate, linking and crop/mirror state.

Source series record packed x/y/confidence and explicit observed,
manual, interpolated or missing states. Limits bound jobs to 60 seconds/7200 frames;
UI limits six tracks and four plots per clip. Results are visit-only.

`PresentedFrames` publishes when the actual native seek completes or the decoded
sample is drawn, not when a cursor requests it. Card overlays subscribe to that frame. Plot cursors follow the requested review
frame: WebKit can defer a paused native seek while the video is scrolled out of
view. During playback the review cursor is itself published only after the shared
presentation barrier, preserving plot/overlay alignment. Data is immutable after completion, and local polynomial
fits for derivatives use real presentation timestamps. Continuous point paths permit
one-sided fits at endpoints and impacts; fits do not cross impacts. Acceleration exactly at an inferred impact is undefined. Missing pose samples and legacy sparse manual corrections
break fits. Estimated samples also mark derivative windows that depend on them.
Measurements remain in source pixels/seconds as review speeds change. Storage and drawing use image-down coordinates; plots convert vertical
position to height above the original image bottom, giving upward-positive vertical
velocity/acceleration. Motion configuration and plots have separate disclosures.
The renderer shared with export uses the same crop/mirror mapping;
optional plot panels use cached derived series. Export is a snapshot of completed
results and never calls inference. Body angles are image-plane projections only.

`dataExport/` provides section-specific numerical JSON downloads through an owned,
cancellable worker. Schema `tenmulate.analysis-data` version 1 uses explicit units,
source frame/time columns, null missing values and observed/manual/estimated states.
The worker snapshots completed data without transferring live buffers, decoding
video or rerunning inference; File objects, blob URLs and thumbnails are excluded.
Its output Blob is limited to 128 MiB. UI changes, removal, navigation and hiding
the tab cancel pending generation; object URLs are revoked on invalidation/unmount.
A ready link remains for browsers that require a second user gesture to download.

Motion exports retain pre-repair tracking evidence and direct pose model outputs
at detector sampling frames (including confidence below the display threshold),
separately from draft interpolation and stabilized coordinates. They include all
tracks/landmarks/joints regardless of visibility, source-time derived metrics and
both default stabilized and unsmoothed joint curves. Plot exports use `plotData`
at each plot's smoothing setting without display downsampling or zoom clipping.
Partial analyses are explicit. Series lacking retained evidence report null;
derived estimates are never relabeled as raw detections. None of these downloads
adds durable browser storage or an import format.

The analysis worker, TF runtime, graph weights and WASM are excluded from initial
imports and service-worker precaching. Optional assets use a bounded CacheFirst
runtime cache. WASM comes from exact npm dependencies; model hashes and attribution
are checked alongside lazy-import regression tests.

Contact alignment maps comparison time to source time as
`source = contactTimestamp + comparisonTime * clipSpeed`. Frame stepping uses
actual presentation boundaries; the shared step chooses the next/previous boundary
across all clips. Manual navigation seeks inside the selected presentation sample.
Continuous playback owns a clock outside React state; UI time reports never feed
back into that clock. Global playback speed scales comparison time and multiplies
each clip's speed in the source-time mapping. Rate changes re-anchor the clock
without resetting the contact alignment or current position.

The shared frame reader prefers Mediabunny VideoSampleSink through WebCodecs. Monotonic
sample requests use the same indexed frame interiors as manual navigation and
decode packets sequentially, without repeated native video seeks. Each clip keeps
a lookahead queue of at most twelve samples, with a byte budget of
`min(16, 48 / clipCount)` MiB plus one sample. Review pictures are capped to
1280×720 pixels of area (aspect preserved, maximum edge 1920); large hardware
frames are copied into bounded canvases and closed before entering lookahead.
Browser-internal decoder buffers are additional to this application budget.
Analysis/source coordinates and final export resolution remain unchanged. Consumed
samples and canvases are released immediately. Startup and underrun recovery prime a short runway of decoded frames.
Capability/sample waits have cancellable ten-second deadlines that also close late
frames. If the capability probe or decoding fails, the reader continues from the first
undelivered request using an isolated native HTMLVideoElement. It seeks indexed
sample interiors, snapshots them into owned canvases, and feeds the same bounded
queue and presentation barrier. This covers files exposed by the native decoder
but not WebCodecs; it is slower than sequential hardware decoding. Aborting wakes
pending media waits, closes iterators, releases snapshots and revokes local URLs.

One animation callback selects frames for a single comparison time, verifies all
are decoded, then draws every clip to its canvas before publishing that time to
the cursors. It explicitly presents time zero when crossing contact, so even a
refresh that straddles zero shows all marked contact frames together. Shorter
clips hold their edge frames. If any decoder falls behind, all displayed pictures
and the shared clock wait together, then resume without a catch-up jump. Decode
work continues during the wait; the scheduler does not restart decoders. This
preserves alignment under load but cannot guarantee the requested wall-clock rate
when the device cannot decode fast enough. Browser display refresh can skip
intermediate source frames at high effective speeds.

Paused review uses `useClipPreview` and `PreviewFrames` to draw explicit decoded
frames into the same canvas as playback. Metadata or `seeked` alone never publishes
a picture. Scrubs coalesce to the latest target; obsolete samples are closed without
drawing. The last picture remains during handoff; loading/recovery and a local retry
are visible. Recovery preserves contact, crop, tracks and other annotations. Canvas
context loss invalidates the presented frame and restoration retries the reader.

Random-access review, export-preview and thumbnail readers share one priority queue:
interactive requests precede filmstrip requests. At most two input/native readers
stay warm, with idle release after 1.5 seconds. Indexing is serialized separately
with a one-minute deadline. Filmstrips start after the card's first picture, use the
same fallback reader, and are canceled during playback, dialogs, route changes or
backgrounding. The native fallback is muted, inline, explicitly loaded/primed, then
paused and sought to the requested frame interior. It mounts a tiny render-viewport
surface in the active dialog or document; an off-screen card/thumbnail host can
report `readyState=4` while WebKit still produces black pixels. Native samples are
owned canvas snapshots so eviction or a subsequent seek cannot change them.

Canceling a session disposes inputs and queues; late decoded samples are closed and
cannot draw over a new session. Compatibility playback reports its performance
tradeoff without disabling synchronized review. Rotation and pixel aspect metadata
are applied when drawing; mirror/crop transforms apply to the review canvas.

Clips and alignment settings live only in memory for the current app visit. The
comparison surface remains mounted across navigation but pauses when hidden.
Removing a clip or unmounting the app cancels indexing/thumbnail work, releases
video decoders and decoded samples, and revokes object URLs. No footage or derived frames enter saves,
project-file middleware, service-worker caches or a remote service.

### Compatibility and comparison export

Container recognition, WebCodecs decoding, native video decoding, and output
encoding are distinct capabilities. MP4/MOV extensions do not specify the codec,
profile, level, bit depth or device decoder support. A successful native manual
seek therefore does not imply `track.canDecode()` will succeed. The reader tries
both decode paths, including recovery from runtime WebCodecs failure. Formats that
cannot be indexed or decoded by either path require conversion, typically to
H.264 MP4. Adding software/WASM codecs could extend local support at a download,
CPU and memory cost; server transcoding would require a separate upload service
and privacy model. Neither is part of the current local-only implementation.
See [Mediabunny codec support](https://mediabunny.dev/guide/supported-formats-and-codecs)
and [WebCodecs codec selection](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection).

Export plans snapshot included clips, contact marks, excerpts, crops, clip speeds,
mirror flags, time range and layout. Stable row IDs support arbitrary per-row clip counts;
moving a clip removes its old slot and any empty row. The compositor assigns equal
row heights and equal cell widths within each row, then contains each source at
its cropped aspect ratio. Image sheets instead flatten the chosen column order
and sample shared comparison times down the vertical axis.

The export dialog uses persistent random-access decoders for its timeline preview,
with native fallback when WebCodecs is unavailable. Requests are serialized per
clip and coalesced across rapid scrubs. A revision check prevents stale pictures
from replacing newer configuration or timeline requests. All clips finish before
a frame is composed. The preview and final render share crop, grid, label and
image-row drawing functions. Preview canvases are bounded to 1280 × 720; the output
uses the configured resolution. Starting export or closing the dialog releases
preview decoders. Preview playback is capped at 30 refreshes/sec and waits under
load; offline export preserves the chosen output FPS and duration.

Offline export uses the same indexed frame reader as playback, with monotonic
requests for each output sample. Decoding is concurrent across clips; rendering
waits for all pictures before writing a frame. The output clock is independent of
render duration, so native fallback latency cannot alter export speed or alignment.
Video encoding probes H.264/MP4, then VP9/VP8 WebM at the selected dimensions/FPS.
Mediabunny CanvasSource writes explicit timestamps and durations to an append-only
bounded output (fragmented MP4 or append-only WebM), without real-time screen
recording. A refresh/sample interval crossing zero includes the marked contact
pictures. Encoders and frame iterators are canceled on close, cancellation or failure.

PNG sheets keep common row timecodes and column headers. A logical sheet larger
than a safe canvas is partitioned into vertically consecutive pages, at most
8192 pixels per side and 16 megapixels each. A ZIP32 store-only archive groups the
already-compressed PNG pages; a single page downloads as PNG. Explicit work limits
(36,000 video frames, 10,000 image rows) and a 256 MB result budget bound local work.
Only an explicit download writes the result outside the session; outputs are not
persisted in app saves or service-worker caches.

## Persistence, localization and delivery

Production saves use versioned browser localStorage. Explicit configs are stored
per Quick Practice mode; unfinished editor drafts are separate from saved drills.
Saved browser overrides take precedence over bundled defaults. Reset config
restores the mode defaults without deleting overrides; saving explicitly replaces
them. Project-file writes are restricted to Vite development middleware and are
absent from the deployed application. There is no silent destination fallback.

English/Simplified Chinese fixed UI and built-in content share stable identities.
User-authored names, descriptions and cues are never translated automatically.

Vite produces static files with a service worker for cached/offline reuse. Optional
video decoder, export and indexing-worker chunks are excluded from installation
precache so they do not compete with first-page downloads. A bounded cache stores
their content-hashed JS/CSS after first use. Runtime assets and their cache policies
are versioned; uncached resources need a network.
Build and delivery commands live in [AGENTS.md](../AGENTS.md). Device and broader
acceptance limits are tracked in [open work](open-questions.md).

## Serve-speed reconstruction

`video-comparison/speed/` implements browser-only endpoint reconstruction, adapted
from Tennis Match Edit's deterministic `launch_speed.py` (see attribution). There
is no agent, visual model, upload or backend dependency. The opt-in module worker
is created for court fitting after sufficient independent references are marked,
or for explicit speed estimation, and terminated on completion, cancellation, changed
evidence, page deactivation or clip removal. Results carry the input signature and
frame-index identity; late replies cannot replace newer settings.

Annotations use original oriented source coordinates, independent of crop/mirror.
Each baseline/service-line or net segment retains its source frame, annotation
precision and optional half-width span. Different lines may use different frames;
each segment's endpoints use one frame. `courtCoverage` accepts any three of four
ground lines plus the centre strap and at least one side support. Near service Y is
5.485 m, far service Y is 18.285 m. Near baseline/service half spans use the centre
mark/intersection and one singles sideline; both full far lines are then required.
The minimum set gives eight ground controls plus two elevated net tops; extra lines
and the other support contribute additional controls to the same 3 × 4 camera fit.
Absent observations are never fabricated. Portrait source dimensions are accepted.
The court is 8.23 × 23.77 m, supports are 1.07 m high and the centre strap is 0.914 m
high. Doubles posts are 12.798 m apart; singles sticks are 10.058 m apart.

`courtControls` enumerates each near half's left/right correspondence and, when only
one support is present, its side. With both supports, original-image ground ordering
sets A/B correspondence. Each candidate jointly fits the observed controls and is
ranked by standardized Huber reprojection loss. A gap below 9 between the best two
candidates is rejected as ambiguous; this is a deterministic margin, not a statistical
confidence level. Calibrations retain resolved sides, observed world control points
and coverage counts. Preview badges account for mirroring while exports retain
original-image/world sides. Individual removal invalidates calibration/results and
cancels obsolete worker jobs; incomplete coverage never reuses a previous camera.

Weighted linear initialization is refined in image pixels using damped Gauss–Newton
and a Huber loss. Every observation, including downweighted endpoints, retains a
reported residual. All landmarks contribute to fitting; these residuals are fit
diagnostics, not held-out validation. Per-mark screen precision supplies a lower
uncertainty bound. Moderate mismatch produces a named review hint and raises the
perturbation scale; gross mismatch uses precision- and court-span-aware rejection
thresholds with the offending mark and error. Crossed full-width reference
quadrilaterals, coincident supports, insufficient net elevation and behind-camera
projections remain invalid. This is
a fixed camera model without motion compensation. Optional centred radial correction
maps original image coordinates to a rectilinear approximation before fitting. For
`d = (image - .5) * (width,height) / (hypot(width,height)/2)`, use
`d_corrected = d * (1 + k*r²/(1+r²)) / (1 + max(k,0)/2)`, with `r² = dot(d,d)` and
`k ∈ [-.8,.8]`. This monotone map is invertible throughout the image and outside it;
it is a manual single-parameter approximation, not automatic lens calibration.
`Camera.p` projects to corrected coordinates; `camera.lens` records the inverse
needed for source-image overlays. Marks and reported residuals stay in raw pixels.
Contact and bounce rays use corrected pixels, while projected flight overlays are
inverted back to original coordinates. No crop, mirror or lens edit mutates footage.

The contact ray intersects a plane at the assumed depth inside the selected serving
baseline, solving lateral position and height together. The default is 0.5 m ± 0.2 m
inside the near baseline; users can adjust it or select the far end. Height is thus
derived from the elevated net calibration and contact pixel **conditional on depth**,
not independently observed from one view. The first-bounce ray intersects a
ball-centre plane 0.0335 m above the court. Airborne points are never mapped as if
they were on the ground. Source presentation timestamps
provide elapsed time, divided by an explicit recording-slowdown factor. Playback
rates are intentionally absent from this calculation.

In the vertical plane between these endpoints, RK4 integrates gravity and quadratic
drag. A damped Newton solve recovers launch velocities that reach the bounce at its
measured time. Default drag is 0.020 /m. Without intermediate marks the central
zero-lift calculation is unchanged. With marks, bounded deterministic search fits a
signed effective Magnus coefficient (±0.04 /m) against original-pixel projections.
The acceleration is `u′ = -D*v*u - L*v*w`, `w′ = -g-D*v*w+L*v*u`, with
`v = hypot(u,w)`; negative L gives downward topspin curvature. The ground projection
stays on the endpoint line. Capped normalized residual loss establishes consensus;
at least 60% of marks must agree within three marking-uncertainty units (5 px floor).
Every excluded mark and residual is exposed, including in JSON. Flat evidence within
one uncertainty unit preserves L=0. A profile of accepted observations supplies an
additional lift sensitivity range. Camera/endpoints never move to fit flight points.
Only the final fitted central path must clear the net and avoid early ground contact. This does not implement the reference's
partial-flight optimization route or infer unseen bounces/sideways spin.

Deterministic sensitivity trials vary local frame timing (including VFR intervals),
contact depth, pixel/region marks, drag and lift, using parameter corners, independent
annotation perturbations and combined independent/correlated perturbations. Each
scenario re-derives contact height; both speed and height ranges are retained.
With corrections, warm-started least squares also refits accepted observations under
perturbed geometry/timing/drag; combined trials perturb their pixels. Trial paths
with independent lift variation remain in the envelope, preventing the fit from
hiding model sensitivity. Intermediate fractions use source PTS and scale with the
trial flight duration. No fit claims spin rate or a statistical confidence interval.
Perturbations touch only observed annotations. The trial count is 16 parameter corners,
8 per marked line, 8 ball-position trials and 64 combined trials. Correspondence is
re-evaluated during geometry perturbations; ambiguity or a changed half/support side
rejects the estimate as unstable. This preserves uncertainty checks for reduced
geometry rather than treating a partial view as equally precise. The
reported min/max envelope includes net-collision variants with a warning. Numerical
instability or a range wider than half the central speed blocks reporting. It is
not a statistical confidence interval or a guarantee of real-world accuracy.
The panel presents ball marking before court mapping; annotations remain independent
until estimation. Preview overlays use the same result with the actual presented-frame
clock. Court lines and ball positions/flight have separate visibility flags. These
flags are excluded from the estimation signature, so toggling them neither cancels
a job nor invalidates its result. Saved measurement overlays are temporarily hidden
during annotation; only the active guide is drawn. Completing or cancelling the
annotation restores the selected overlay groups.
`SpeedMarkingModal` opens a full-viewport native dialog for each court/ball item.
An independent, lazily loaded `PreviewFrames` decoder coalesces seeks, disposes
stale samples and enables marking only for the actually drawn source frame. A local
LRU owns at most four snapshots/24 MiB (plus the visible surface); VideoFrames close
immediately. Interactive requests outrank filmstrip work. The previous picture stays
visible while seeking; a 250 ms delayed nonblocking status avoids flickering masks.
Lens edits redraw a snapshot without decoding. Optional WebGL warping owns one
context; a cached bilinear software remap, capped at 1280 px long edge, handles
unavailable/lost WebGL. Disposal releases snapshot, map and GPU resources.
The native fallback mounts inside the visible dialog so WebKit presents decoded
pixels even when its review region is scrolled out of view. A separate short-lived
reader prepares its thumbnail lane through the shared priority queue, without
moving the review frame; both readers release media elements and URLs on disposal.
The uncropped canvas respects mirror orientation while storing original normalized
coordinates and screen precision. Its `ClipTimeline` reuses zoom/pan without trim
handles; review never drives linked playback. Background analysis and comparison
playback pause during marking. Closing releases the decoder, restores document
scrolling and returns focus; late tool loads cannot reopen the dialog.
Line gestures commit the release position as the start, then commit the next release
as the end; a third press replaces the line. Pointer cancellation cannot commit a
partial drag. A shared floating 4× canvas magnifier samples the displayed frame
for all court/ball markings and motion-tracking start, end and correction selections.
It respects the visible crop and mirror orientation, clamps the glass within the
picture, and uses the existing canvas without allocating a decoder. The modal
passes its lens-corrected canvas; the inverse transform saves original coordinates.
Release, pointer cancellation or a frame change dismisses the glass; tracking
selection also resets an active gesture when frame readiness or crop/mirror changes.
Drafts and
lens edits are local until Save; frame/span/lens changes clear the active draft. Contact saves update the
ball annotation and synchronization anchor together; invalid subsequent endpoints
and flight checks are removed. Court bounds span the source, while ball bounds
respect the excerpt and contact/bounce order. Short landscape layouts put controls
beside the picture; other layouts place the timeline below it.
The section's JSON export retains partial annotations, calibration, dimensions
assumed from standard court geometry, assumptions and checks, plus the complete
speed result. Model path samples carry world XYZ alongside image projections;
their 3D polyline arc length is separate from horizontal contact-to-bounce distance.
Physical flight time and source time are both provided using recording slowdown.
Court and ball overlay toggles share one row. Grid exports snapshot only a current
serve result via the pane's result lifecycle; stale/cancelled jobs never provide one.
Per-clip speed-label toggles default off and use the same cell compositor in interactive
preview, video and image sheets. Text renders outside crop/mirror transforms. It is
visible for `0 <= sharedTime / outputRate < 3`, bounded by the clip's excerpt end in
the shared clock; held end frames cannot extend it. Measurement edits invalidate
eligibility; visual overlay toggles do not.
Validation uses analytical ballistic cases and synthetic projected
courts with known launch motion; field calibration against radar remains open.

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
