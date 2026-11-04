# User guide

Tenmulate is for shadow-swing timing, incoming-ball judgment and tactical mental
rehearsal. Use a large display and clear enough space for your full swing and
movement. The app cannot check your room or measure your actual stroke.

The main sections have their own URLs: `/quick-practice`, `/drills`, `/editor`, and
`/video-comparison`. You can bookmark them, open them in a new tab, or use browser
Back/Forward. Refresh keeps the current section. Local comparison videos and their
analysis remain session-only; reselect the files after a refresh.

## Quick Practice

Choose the shot you want to practice. **Opponent shot** controls the ball coming
to you. Rally, Return, Volley and Overhead each have their own starting setup.

1. Choose a mode, then adjust the incoming shot, pace, spin or timing if needed.
2. Drag a landing zone to move it; drag an edge or corner to resize it.
   **Top-down court** makes the opponent and zones easier to place. Drag the blue
   camera icon to move your receiving position; drag its direction handle to turn
   your view. Release to apply, or press Escape to cancel the drag.
3. Under **Practice set**, choose **Reps per set**, **Number of sets**, and
   **Rest between sets**. The total is calculated for you; a single set has no
   rest break. **Timing variation** remains under **Ball & rhythm**.
4. Select **Start practice** to begin a fresh timed set.

The yellow zone is the incoming ball's landing area. The blue zone is the target
for your illustrative return. Blue stays visible during playback; yellow hides.
**Trajectory** controls the incoming flight line independently of those zones.
Top-down editing shows incoming trajectories; the illustrative Quick Practice
return never shows its own trajectory line.

**Reset config**, above Save config, restores the current mode's defaults:
camera, both zones, opponent, shot settings, timing, practice set and display/
environment settings. It does not erase saved configs; select **Save config** to
replace a saved setup with the reset one. **Reset view** changes only the view.

Your camera position represents your on-court receiving position. A ball may be
physically valid yet too far from that position to receive, or your return may not
connect to the next opponent contact. If edits produce an unreachable setup, Reset
config provides a working starting point. Natural trajectory fitting can adjust
pace/spin within bounds; exact settings can be impossible for a chosen target.

Rally connects exchanges. Return, Volley and Overhead use independent feeds with
an illustrative player response. Volley starts between the service T and net;
Overhead starts near the T with an upward view. Starting a set clears the preview
and resets the clock. A newly changed, complex setup can still need calculation.
You can start while the live preview is updating; preparation uses your current
settings. Editing those settings while preparing cancels the pending launch.
Practice and drills begin once their opening shots are ready; later shots prepare
in the background. If preparation falls behind playback, **Preparing next shots…**
appears and the clock waits, then continues automatically. A manual pause stays
paused. Skipping ahead reaches only prepared shots. If later settings cannot form
a valid sequence, playback stops with an explanation so you can return and adjust
them.
Older saved totals are preserved, including a shorter final set. Changing reps
per set or the number of sets switches that setup to complete sets.

## Drills and editor

Drills rehearse a sequence of **your shots**, with opponent feeds/returns and
movement between views. Choose an existing drill and **Edit drill**, or select
**Create new drill**. A fresh editor with no recovered draft is blank.

- Add shots from the library to the timeline. Configure your blue landing zone,
  the opponent's yellow return zone, each ball's settings and your shot view.
- In **Top-down zones**, drag the camera icon or its direction handle to edit the
  selected shot's position or heading. Height, tilt and field of view stay unchanged.
  For camera events, use the capture controls to store the adjusted intermediate view.
- Configure the opening opponent feed/serve for each point. Opening serves retain
  their authored receiving view and serve pace; the illustrative return adapts.
- Select a narrow camera event between shots to configure movement and focus.
  Capture an intermediate position or direction without changing the shot view.
- **Preview actual shot** includes resolved contact and movement; **Preview
  sequence** plays the complete authored sequence. Isolated previews are estimates.
- **Player handedness** mirrors court setup for left-handed play while retaining
  the opponent's chosen hand.
- **Add New Shot** creates a preset; **Save shot** creates or updates a named one.
  Right-click a shot-library item or use its menu to delete it. Existing timeline
  shots retain their own settings when a library preset changes.

Before **Run drill**, set the total repetitions of the whole drill and rest between
repetitions. One repetition includes every authored player shot. The final ball
finishes before rest; there is no extra rest after the last repetition.

## Video Comparison

Open **Video Comparison** beside Quick Practice, Drills and Editor. Click the empty
video zone to choose local videos, or drop up to nine clips onto the page. A vacant
slot remains to the right of the loaded clips for adding more; at nine clips it
shows the limit until a clip is removed. Files are read on your device and
never uploaded. Each video initially displays its full image, including portrait
clips. Drag a pane's grip to reorder it and its right edge to change
its width. Arrow buttons also reorder panes; a focused grip or resize edge accepts
the left/right arrow keys. Wide arrangements scroll horizontally. The video area
uses the available lane height and adapts when the window is resized or the device
rotates. Scroll down within the lanes to reach each clip's thumbnails and controls;
the shared playback controls stay visible below the lanes.

Use the **Mirror video horizontally** button beside a clip's close button to flip
that video and its thumbnail images left to right, for example to compare
left-handed and right-handed swings. The button stays highlighted while mirroring
is on; select it again to restore the original orientation. Each clip toggles
independently, without changing playback, contact alignment or timeline direction.

Use the **Crop video** button to the left of Mirror to enter crop mode. Drag on the
image to draw a crop, move the selection, or drag its corners. **Draw crop** lets
you replace the selection by drawing a new rectangle. Choose freehand,
a preset aspect ratio, or **Fit preview zone**. Crop mode shows the original,
unmirrored image so source coordinates stay consistent. **Done** applies the crop;
**Cancel** restores the previous crop; **Reset crop** restores the full frame.
The selection and corners support arrow keys (Shift for larger adjustments).
The cropped image fits the card without stretching and is mirrored afterward.

Scroll over a thumbnail lane or pinch with two fingers to zoom around that point.
The +/− buttons also zoom; **Fit full timeline** zooms out. Shift-scroll, horizontal
trackpad scrolling, or the pan slider moves the visible window. Zoomed views load
thumbnails for the visible interval. Zoom never changes the clip or excerpt.

Drag the yellow handles on a clip's lane to select an inclusive source-frame
excerpt. **In** and **Out** use the current frame; **Reset excerpt** restores the
whole clip. Handles support arrow keys and Home/End. Review, frame stepping,
synchronized playback and export all stay within the excerpt; shorter excerpts
hold their first/last selected frames. Contact marks keep their original source
positions. If you trim contact out, the card reports it and holds the nearest
excerpt boundary at contact time; reset/extend the excerpt to include contact again.

1. Scrub each clip's thumbnail lane to find racket–ball contact. The narrow lane
   below it provides fine adjustment (eight pixels per frame); its left/right
   arrow keys move one source frame at a time when focused.
2. Select **Set contact**, beside **Clip speed**, in each pane. The button's tooltip
   shows the marked frame and time. Once every clip has a contact, the timelines
   link automatically and jump to contact time zero.
3. Play/pause together, drag the shared timeline or any clip's lane, or use the
   shared frame-step buttons. The shared buttons move to the next/previous frame
   boundary across all clips, so a higher-rate clip may advance while a lower-rate
   clip still shows its current frame. **Contact frame** returns every clip to its mark.
4. Adjust each **Clip speed** from 0.10× to 2.00× to compare motion rhythms. Speed
   changes pause and return to contact; the shared timeline and manual scrubbing
   use the same factor. At 0.50×, one second after contact advances that source by
   half a second. Uncheck **Link timelines** to adjust clips independently.
5. Use **Playback speed** beside the shared controls to play the whole comparison
   at 0.25×–2×. It multiplies each clip's speed: a 0.50× clip at 0.50× global speed
   plays at 0.25× its source speed. Changing global speed during playback preserves
   your position and contact alignment. Scrubbing and frame stepping keep their
   original source-frame precision at every global speed.

### Motion analysis

Open **Motion analysis** below a card's controls. Select an excerpt first; short
3–15 second strokes or rallies work best. Analysis is local, visit-only and opt-in.
It supports up to 60 seconds / 7200 source frames per job. One clip analyzes at a
time, yielding during playback, export or when the page is hidden. **Cancel analysis**
stops it; closing a card cancels its jobs. First pose use downloads about 6 MB of
model/runtime resources from this site; subsequent requests can use the local cache.

- **Add point or region track** pauses review and brings the video into view.
  Choose a start frame and tap the ball/racket head or drag a small textured area
  around it. Then choose an end frame and select the same target there. Use the
  existing preview lane or fine-scrub lane to navigate while selecting either point;
  there is no separate selection slider. The end must be later than the start,
  inside the excerpt. Canceling the second selection
  keeps the start so you can finish it with **End position**. Keyboard users can
  aim with arrows (Shift for larger steps) and press Enter.
- **Track between anchors** analyzes every source frame in both directions between
  those two positions. Up to six tracks have their own names, colors and visibility.
  A point is the center of the selected area, not a recognized object boundary.
  Tracking adapts to changing appearance, rotation and scale, and searches around
  both the last position and predicted motion to follow reversals. Competing matches
  from both directions are retained and compared across the range. Observed loops
  and turns are kept; smoothing can move an observed position by at most 0.75 original
  pixels. Nothing is extrapolated beyond the chosen start and end.
- Lighter solid trail sections, hollow markers and **≈** distinguish estimated
  portions, including gaps filled without image evidence. Short gaps use observed
  entry/exit directions where available; longer gaps cannot reveal hidden turns. Continuity is not proof
  of accuracy: an obscured or indistinguishable target can still take an incorrect
  inferred path. **Review estimates** jumps through these sections. At a visible
  frame, choose **Set correction here**, place an anchor and rerun tracking. Changing
  anchors clears the old result. Small, blurred or very fast balls can need several
  corrections. The supported-frame count includes manual anchors and accepted matches.
- Turns and abrupt changes are detected automatically from the tracked motion;
  there is no turn-frame checkbox. You do not need to add a correction at every
  turn. Image-supported short loops are distinguished from unsupported outward-and-back
  spikes. Acceleration exactly at an inferred instantaneous impact is undefined;
  velocity uses the outgoing side. Contact marks align playback and do not instruct
  the tracker to invent a turn. Corrections still help when appearance is ambiguous.
- **Analyze pose** estimates one player's 17 body landmarks automatically from the
  full frame; there is no player-region selection. Weak detections may retry an
  automatically followed body region. **Draft** samples up to 15 times/second;
  **Every source frame** is preferable for fast movement.
- Pose stabilization removes brief unsupported out-and-back landmark jumps and
  repairs short missing joints using a visible parent/body. Interpolation spans at
  most 250 ms; extrapolation stops after 120 ms and cannot extend itself. Longer
  occlusions remain gaps. Hollow landmarks, dashed bones and **≈** distinguish
  estimates in preview and export. Severe blur, crossing players or limbs pointing
  directly toward the camera can still be ambiguous. Track racket heads separately.
- Joint labels use a confidence-weighted temporal curve (100 ms by default).
  Angular velocity and acceleration come from that same curve, reducing noise
  amplification while retaining sustained fast motion and repeated turns. Original
  model detections remain available with **Raw** in plots; draft intervals there
  still use interpolation. Smoothing cannot make inferred motion into a measurement.
- Toggle trajectories, skeleton and projected joint angles independently. Choose
  a trailing duration or the full trajectory. All eight joint angles and the full
  trajectory are enabled by default. Crop and mirror apply to overlays
  exactly as they do to the image. Completed analysis stays aligned while changing
  contact marks and clip/global playback rates; it does not run again during playback.
- **Motion plots** opens independently of **Motion analysis**, so you can collapse
  configuration while keeping charts visible. **Add plot** adds up to four charts
  per card. Select a track, body landmark or
  joint and a parameter: positions, velocity, speed, acceleration, confidence or
  joint angle and its derivatives. Plots follow the lane's zoom window and review cursor. Drag or use arrow keys in a plot to seek, including linked timelines.
  A fixed dashed line and diamond mark the contact frame whenever it is inside
  the zoom window; the solid cursor shows the current review frame. The marker
  updates when contact changes and also appears in exported plots.
  Point positions and the overlay share the same reconstructed path. **Derivative
  smoothing** controls the time window for velocity/acceleration, without changing
  that path. For joints, **Smoothing** controls a shared angle/velocity/acceleration
  curve; 100 ms matches the overlay labels. Fits stop at point impacts and unsupported
  pose gaps. Derivative readouts influenced by estimates also show ≈.

Positions and derivatives use original source pixels and encoded source seconds,
not resized preview pixels or slowed playback time. Y increases **upward** from
the bottom of the original image; upward velocity and acceleration are positive.
Crop and mirror change the view, not the measurement coordinate system. Angles
are 2D projections, not 3D joint measurements; camera movement, perspective and
tracking noise affect all measurements, especially acceleration. These tools provide
visual review estimates, not calibrated real-world speed or technique assessment.

**Export overlays** in the export dialog controls trajectories, skeleton, angles
and plots independently for each included clip, for both grid video and grid images.
The rendered preview and final output use the same cached source-frame data. An
unfinished job pauses while the dialog is open; only completed results are included.
Close export to resume analysis. No analysis survives closing/reloading the page.

Frame rate and frame stepping use the file's actual presentation timestamps,
including variable-rate footage. The displayed FPS is an average. Shorter clips
hold their first or last frame outside their coverage; the full comparison range
remains available. Sound is muted. Playback decodes frames ahead and presents all
clips at the same contact-relative time. The actual marked contact pictures appear
together when playback crosses zero, as they do when scrubbing or stepping. Global
and individual speeds use this same alignment, including very low combined speeds.
If a decoder falls behind, **Preparing synchronized frames…** appears and the
pictures and cursors wait together; playback resumes from that position without
jumping ahead. On a device that cannot decode fast enough, playback may run slower
than requested to preserve alignment. Leaving the page or hiding the tab pauses
playback. Pause/step remains available for inspecting every source frame.

Clips, contact marks, order, widths, individual and global speeds, mirror, excerpt
and crop settings survive navigation within the app but are not saved across a reload or
closing the app. Removing a clip releases its local resources. MP4/MOV/WebM support depends on the browser's codec support.
Review and synchronized playback prefer WebCodecs decoding. If that API cannot decode the
file, the app automatically uses the browser's native decoder in compatibility
mode, keeping contact alignment. Compatibility playback can be slower because it
prepares individual frames. A browser can support a file in its native video player
without supporting the same codec/profile through WebCodecs. If neither decoder
can read the file, try converting it to H.264 video in an MP4 container.
A card shows **Preparing video preview…** while decoding and automatically tries
recovery after a failed attempt. **Retry preview** reopens the decoder without
removing your clip or annotations. Review and thumbnail work are scheduled to limit
simultaneous decoders; unused readers are released and the last drawn picture stays
visible. Large sources use a smaller display canvas to reduce memory; measurements
still use original source pixels and final exports keep their configured resolution.
If retry still fails, try a shorter/lower-resolution H.264 MP4. Codec/profile support
and available device memory still limit which files can be decoded. Clips and frames
are not saved in site caches or session storage; clearing site data is unnecessary
for decoder recovery and would erase unrelated practice saves. Very long files with
more than one million video frames require a shorter excerpt.

### Download numerical analysis

**Export JSON** beside each section heading saves a separate file for that clip,
even when the section is collapsed, once the video's dimensions are loaded.
These downloads contain numerical data and
annotations, not video footage. JSON preserves the nested landmarks, calibration
and time series for analysis in Python, R or similar tools.

- **Motion analysis:** every track, manual anchor, full-resolution position series,
  confidence/state, retained tracking evidence before repair, pixel trajectory
  length and position/velocity/acceleration metrics. Pose exports include all 17
  landmarks, skeleton connections and all eight joint definitions with stabilized
  and unsmoothed angles, angular velocity and angular acceleration. Direct model
  detections, including low-confidence detections, are separate from interpolated
  and stabilized coordinates. Hidden tracks and joints are included.
- **Motion plots:** all configured plots, their targets, units and smoothing
  settings, and every available sample. Downloads are not clipped to the chart's
  current zoom, excerpt or screen resolution. Estimated samples are identified.
- **Serve speed:** all court/ball annotations and source frames, standard court
  dimensions used for calibration, camera fit and diagnostics, assumptions,
  reconstructed contact/bounce coordinates, speed results and the modeled 3D
  flight samples and arc length. Incomplete measurements can be saved before
  calibration or estimation; unavailable results are `null`.

Each file has schema `tenmulate.analysis-data`, version `1`, and a `section` field.
The `clip` object includes original source dimensions and frame timestamps, current
excerpt/contact and presentation settings. `conventions` documents coordinates,
time and missing data. Frame indices are zero-based; `displayFrame` is one-based.
Parallel arrays share a frame column. `null` means unavailable, not zero. Sample
states are `0` missing, `1` observed, `2` manual and `3` estimated. Normalized image
coordinates are right/down from the original top-left corner; derived motion
metrics use original pixels with upward-positive Y. Rates use source seconds,
independent of playback speed. Serve trajectories additionally identify physical
flight seconds after applying recording slowdown. Standard court dimensions and
model reconstructions are assumptions/estimates, not independent measurements.

Generation runs locally in a cancellable background task and pauses playback.
The button becomes **Download JSON** when ready; tap it if the browser did not
automatically save the file. Editing the underlying data clears that old download.
Keep the page open until saving finishes; there is no analysis-file import yet.

### Export a comparison

Select **Export** to the right of **Link timelines**. Opening the dialog pauses
review; export uses separate local decoders and does not move the review cursors.
Switching to the comparison tab does not wait for video tools to download. Decoding
and export tools load only when needed; first use needs a connection if they are not
already cached. Export loading can be canceled. A stalled or failed tool download
reports an error and allows a retry without discarding the loaded clips.

- Choose **Grid video** or **Grid images**, and include/exclude individual clips.
  Each included clip needs a contact mark. Excluding a clip affects only the export.
- The rendered preview below the layout shows the included clips with their crops,
  mirrors and excerpts. Drag its timeline, step source frames, jump to contact, or
  play/pause to review the selected layout. Image mode previews one time row.
  Drag the yellow handles to set export start/end, or use **Start at cursor** and
  **End at cursor**. Times remain relative to contact. The timeline also supports
  zoom and pan. **Use full selected range** restores the included excerpts' range;
  shorter excerpts hold their boundary frames. Preview waits for all decoded
  pictures before advancing; it may run slower on busy devices. Export duration
  remains deterministic regardless of preview or rendering speed.
- For video, choose aspect ratio, resolution (or custom even width/height), 24–60
  fps, playback speed, and Auto/MP4/WebM. Export speed multiplies each clip's speed.
  Names and the contact-relative timecode can be hidden. Drag thumbnail grips
  between clips or rows to reorder, create rows, or join rows. Each row can hold a
  different number of clips, including a 3 × 3 arrangement for nine clips. Select a
  clip and then an insertion point for a keyboard/touch alternative; single-row, single-column and automatic presets
  provide starting layouts. Each edited clip fits its cell without stretching or further cropping.
- For images, clips form columns and shared contact-relative times form rows.
  Reorder columns, choose evenly spaced rows or every distinct synced frame, and
  set cell width/aspect ratio. Contact gets a dedicated row whenever it lies in
  the range, so the actual row count can be one greater than the sampling setting.
  Column names and row timecodes are included. Large sheets split into PNG pages
  with repeated headers, downloaded together in one ZIP; the dimension summary
  shows the complete logical sheet and page count.

Select **Start export**, then **Download export** when rendering finishes. Cancel
or close the dialog to stop a job and release its decoders. Exports are silent and
preserve clip speeds, contact alignment, and mirror settings. Processing and
downloads stay on the device; there is no upload or server conversion.

Auto output prefers H.264 MP4 and falls back to VP9/VP8 WebM according to the
browser's encoder support at the chosen dimensions and frame rate. If no encoder
is available, try a lower resolution, another browser, or grid images. Native
compatibility decoding also works for export, where rendering can take longer
without changing the exported timing. Video export accepts at most 36,000 frames;
image sampling is bounded to 10,000 synced rows. PNG pages stay within 8192 pixels
per side and 16 megapixels; completed output is limited to 256 MB. Reduce the time
range, sampling density, or resolution if a limit is reached.

### Estimate serve speed

Open **Serve speed** below **Motion plots** on a comparison card. This is available
for portrait and landscape source clips. Keep the camera fixed throughout the
flight. You need at least three of the four court lines, the net's centre strap
and at least one side support. Partial views can work when these references and
the contact/first-bounce ball positions are visible. Fisheye views, moving/zooming
cameras and nonstandard court/net dimensions are unsuitable.

1. Select **Contact ball position** to open the full-screen marking dialog. Its
   own thumbnail timeline, zoom/pan and frame-step buttons let you find racket
   impact; tap the ball centre or tightly box the ball, then **Save measurement**.
   Saving also sets the card's contact frame. Open **First bounce ball position**,
   find the first ground impact in the dialog and save its ball mark. Mark
   the ball, not its shadow. There must be no earlier bounce or net touch. Optional
   **flight checks** at intermediate frames independently test the modeled path;
   inconsistent checks stop the estimate rather than change the court calibration.
2. Mark any **three of four court lines**: near baseline, near service line, far
   service line and far baseline. A fourth line improves the constraints. Each
   marking or saved-frame button opens the full-screen dialog at its saved frame,
   or the current card frame for a new line; each line may use a different clear
   frame from the same fixed camera. Near/far mean relative to the camera.
   For a near baseline or near service line, choose **Line span → Full singles
   width** or **Half width · detect side** inside the dialog. A half line runs
   from the baseline's centre mark, or the service-line/centre-line intersection,
   to one singles sideline; an arbitrary cropped fragment does not establish scale.
   Half-line detection requires both the **full far baseline and far service line**.
   The app compares left/right assignments and displays the detected half in the
   current preview orientation. Ambiguous fits request more or clearer references.
   Select doubles posts or singles sticks, then mark **the centre strap plus at
   least one side support** with top-to-ground segments. Either support can be A
   or B; the app infers the side. Add the other support when visible. Follow the
   physical post/strap even when it leans in the image. Drag or tap both ends;
   arrow keys and Enter also work. The full uncropped image respects mirroring,
   and both endpoints of each segment use the same frame. Remove individual marks
   with their × buttons, or reset them together. Court review spans the full source,
   even outside the excerpt; ball review respects excerpt and contact/bounce order.
3. **Contact height is derived automatically** from the marked ball, the calibrated
   court/net and an assumed contact depth. Court mapping defaults to the near serving
   baseline, **0.5 m inside it with ±0.2 m depth uncertainty**. Adjust the depth or
   choose the far serving baseline as needed; negative depths lie behind the baseline.
   The displayed height is conditional on this depth assumption. Keep recording
   slowdown at 1 for real-time video; enter 4 if the source plays four times slower
   than the original action. Clip and global playback-rate controls have no effect
   on the estimate. Advanced controls expose pixel/timing uncertainty and assumed
   aerodynamic coefficients. Each court mark remembers its screen precision; ball
   marks also retain their region/point uncertainty. Increase the minimum pixel
   uncertainty for blur or imprecise
   marks. Arrow keys adjust the marker by one source pixel (Shift: ten).
4. Select **Estimate serve speed**. The result separates estimated **launch speed**
   from horizontal distance divided by flight time, with a sensitivity range and
   calibration/flight checks. Cyan overlays show court marks, white circles show
   observations and the dashed yellow curve shows the reconstructed flight. Its
   cursor follows the displayed source frame during scrubbing and linked playback.
   Under **Measurement overlays**, toggle **Court lines** and **Ball positions and
   trajectory** separately: either group, both, or neither. Ball positions include
   contact, first bounce and optional flight checks. Visibility changes preserve
   the estimate and saved marks. During marking, saved measurement overlays are
   temporarily hidden so only the active guide is visible; completing or cancelling
   restores the selected groups. Changes to measurements, contact or excerpt
   invalidate the result. **Export JSON** beside **Serve speed** saves the complete
   measurement data, including partial annotations before an estimate is available;
   see **Download numerical analysis** above. It also records full/half spans, the
   inferred half/support sides in original unmirrored coordinates, observed endpoints
   in court metres and the actual reference counts. It contains no video footage.

The full-screen review timeline does not move the other clips or change excerpts.
Only **Save measurement** applies a draft; **Redraw** starts again, and **Cancel**,
the close button or Escape discards it and returns focus to the opener. Moving to
another frame clears the draft, including any half-drawn line. Saved court/ball
overlays remain hidden while marking. If a revised contact moves beyond the saved
bounce, that bounce and invalid flight checks are cleared. On short landscape
screens the review controls move beside the video to leave more room for the image;
the review controls can scroll when the available height is small.

Court fitting runs automatically once the minimum references are present. It combines
every marked endpoint and reports image-space fit error. Partial and half-width
mapping uses fewer references, so small annotation errors can have more influence;
additional full lines and a second side support can reduce sensitivity. Fewer marks
are not guaranteed to be as accurate as a full view. A modest mismatch identifies the line
to review and increases the speed uncertainty rather than blocking estimation.
Large disagreement, overlapping supports or a collapsed top-to-ground segment
requires correction. Re-mark the named line on another clear frame, verify support
type and check for camera movement or lens distortion. Small residuals alone do not
prove the depth assumption or camera model is correct.

This is an on-device physical model, **not a radar reading**. Gravity and quadratic
drag determine the central estimate; timing, geometry, contact depth, drag and lift
are varied for the sensitivity envelope, with height re-derived in each scenario.
That envelope is not a statistical confidence
interval and does not cover every lens, spin, wind or annotation error. A missing
first bounce cannot be inferred by this feature. Speed annotations last for the
current loaded clip/session; they are not included in grid video/image exports.

## View and playback

Drag outside a zone to look around, use the wheel to zoom, and use WASD to move
the setup camera. The displayed camera controls also allow height and direction
changes. Camera-position and perspective presets can be saved separately.
**Ball highlight** changes the approaching ball's appearance without blurring the
court. Playback provides pause, seek, restart, variation and fullscreen controls.

**Sound** is available while configuring and during playback. If prompted, select
**Tap to enable sound**. Adjust contact, bounce, training cues, ambience and crowd
levels; **Crowd sound** and **Mute all sound** are independent controls. The mix
follows you between setup and playback for this visit; reload restores defaults.
Pause/backgrounding fades sound. Loading/failure status offers **Retry sound**;
procedural fallback keeps cues available when recorded samples are unavailable.

**Cast** provides screen-mirroring instructions and an optional local court-capture
preview. iOS uses Control Center to connect to a receiver. The app cannot establish
or verify that connection. Capture can include practice audio; master mute also
silences captured sound.

## Saving, language and offline use

**Save drill**, **Save shot**, **Save config** and **Save preset** save to this
browser on this device. Quick Practice keeps one saved config per mode. Camera
position presets store location; perspective presets store viewing direction and
field of view. In development only, the save dialog also offers project defaults.

Unfinished editor drafts recover separately and do not overwrite saved drills.
Export important drills as JSON before clearing browser data. Browser saves are
not synchronized across devices. Previously loaded assets can work offline;
missing assets still require a connection.

Chinese browser languages start in Simplified Chinese; other browser languages
start in English. Change this with the language selector. Built-in content has
both languages; your own names, descriptions and cues remain as you wrote them.
