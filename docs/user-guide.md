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
3. Set repetitions, work blocks and rest under **Practice set**.
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
