# User guide

Tenmulate is for shadow-swing timing, incoming-ball judgment and tactical mental
rehearsal. Use a large display and clear enough space for your full swing and
movement. The app cannot check your room or measure your actual stroke.

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
video zone to choose local videos, or drop up to five clips onto the page. A vacant
slot remains to the right of the loaded clips for adding more; at five clips it
shows the limit until a clip is removed. Files are read on your device and
never uploaded. Each video displays its full image without cropping, including
portrait clips. Drag a pane's grip to reorder it and its right edge to change
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

Clips, contact marks, order, widths, individual and global speeds, and mirror
settings survive navigation within the app but are not saved across a reload or
closing the app. Removing a clip releases its local resources. MP4/MOV/WebM support depends on the browser's codec support.
Synchronized playback prefers WebCodecs decoding. If that API cannot decode the
file, the app automatically uses the browser's native decoder in compatibility
mode, keeping contact alignment. Compatibility playback can be slower because it
prepares individual frames. A browser can support a file in its native video player
without supporting the same codec/profile through WebCodecs. If neither decoder
can read the file, try converting it to H.264 video in an MP4 container.
An unreadable file shows an error and can be removed. Very long
files with more than one million video frames require a shorter excerpt.

### Export a comparison

Select **Export** to the right of **Link timelines**. Opening the dialog pauses
review; export uses separate local decoders and does not move the review cursors.

- Choose **Grid video** or **Grid images**, and include/exclude individual clips.
  Each included clip needs a contact mark. Excluding a clip affects only the export.
- Set the start and end in seconds relative to contact. **Use full selected range**
  fills the range from the included clips; shorter clips hold their edge frames.
- For video, choose aspect ratio, resolution (or custom even width/height), 24–60
  fps, playback speed, and Auto/MP4/WebM. Export speed multiplies each clip's speed.
  Names and the contact-relative timecode can be hidden. Drag thumbnail grips
  between clips or rows to reorder, create rows, or join rows. Each row can hold a
  different number of clips. Select a clip and then an insertion point for a
  keyboard/touch alternative; single-row, single-column and automatic presets
  provide starting layouts. Each clip fits its cell without stretching or cropping.
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
