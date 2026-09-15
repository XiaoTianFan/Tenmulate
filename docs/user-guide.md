# Tenmulate user guide

The interface supports English and Simplified Chinese. Chinese browser languages
start in Chinese; other browser languages start in English. Use the header language
selector (or playback Settings) to override this. Shipped drills, shots, camera
positions and perspectives are bilingual; browser-created content keeps the text
you wrote. See the [localization contract](development/internationalization.md).

Tenmulate is a browser-based, first-person tennis visualization tool. It places a player at a calibrated on-court point of view and plays configurable incoming ball trajectories for shadow swinging, return preparation, and tactical mental rehearsal.

The repository contains the active V1 implementation: a deterministic Three.js court/ball simulation, complete starter shot library, rehearsal player, local drill editor, independently customizable camera-position and perspective presets, validated JSON exchange, and offline-capable app shell. All six built-in court environments use Blender-authored assets with Quality/Performance variants. A 1.88 m CC0 articulated mannequin runs the 25-clip tennis library, including normal/compact serves and a distinct backhand overhead, in actual gameplay. The ball machine remains the opponent load-failure fallback.

Quick Practice and drills use editable uniform landing zones. Left-drag the interior
to move, a side to resize one dimension, or a corner to resize both. Drag elsewhere
to look around. The zone previews immediately and recalculates the full session once on
release. The editor also updates isolated shot trajectories during zone gestures.
Practice, Editor and drill playback share one mounted court; the library
parks it without rendering. Setup previews stream fresh feeds continuously;
launched sets honor their chosen repetitions and rests. See the
[shared-court verification receipt](development/shared-court-and-zone-resize-2026-09-08.md).

The blue player target zone stays visible during setup and playback. Yellow
opponent landing zones appear while editing and hide during practice or drills.
The Trajectory toggle controls lines independently of zones. Top-down editing
always shows trajectories; returning to player view restores the toggle choice.
Opening playback Settings does not change trajectory visibility. See
[the visibility contract](decisions/0055-trajectory-and-zone-visibility.md).

All four Quick Practice modes animate your response. Configure its destination
with the blue landing zone; player return trajectory lines and trails stay hidden,
including in top-down view and playback settings. Rally connects exchanges;
Return, Volley and Overhead retain independent feeds. Overhead starts at the T,
looking upward and gently tracking the lob, with the opponent at 0.1 m sideways
and 9.8 m from the net. Volley starts halfway between the T and net. **Reset view**
restores those mode-specific positions. See the
[Quick Practice return and camera contract](decisions/0051-quick-practice-returns-and-views.md).

**Cast** opens iOS Screen Mirroring instructions and an optional local court capture
preview. Capture keeps the same canvas/video/audio tracks across setup and practice,
with up to 720p at 30 fps. Direct AirPlay of that live capture is unavailable in
iOS Safari; connecting to an existing receiver still requires Control Center.
The app cannot verify that connection. See the
[capture contract and remaining transport gate](decisions/0034-persistent-court-capture.md).

The drill editor plans **your shots**. **Edit drill** opens an existing library
entry; copying is optional.
Before **Run drill**, use **Practice set** to enter the total repetitions of the
whole drill and rest between repetitions (0–120 seconds). One repetition includes
every authored player shot. The final ball finishes before rest starts; the next
run opens a new point, with no extra rest after the final run. These are launch
settings; Replay same seed and New variation retain them.
Use **Save drill**, **Save shot**, **Save config** and **Save preset**. In local
**development**, every explicit save asks whether to save a **Project default** or
to **This browser**. Production saves directly to durable browser localStorage.
Project defaults are included in future builds; browser versions take precedence
only in that browser. Saves report storage failures without switching destination.

Quick Practice saves one configuration per mode, including camera, ball, landing
zones, environment and display settings. **Save config** keeps the current mode's
setup; selecting a mode restores its saved config. Camera and perspective preset
creation and right-click updates use the same save flow. Unfinished drill edits
are recovered separately; they do not replace a saved library version until saved.
Create/import actions remain at the bottom of the drill library. See the
[unified saving architecture](development/saving-system.md).

An opponent opening feed or serve starts
each point; player presets then assemble the tactical sequence. **Top-down zones**
edits your blue landing zone on the far court and the opponent's yellow return
zone for your next shot. Each event owns both balls' settings and your camera
position; the opponent meets the physical player flight automatically.
Drop shots, volleys and overheads are available; kick/sidespin are serve-only.
New/update presets retain both balls, zones, camera and timing.
**Save shot** opens a form to create or replace a named preset. Both project and
browser destinations retain both balls, zones, camera and timing. Later timeline
additions use the saved preset; existing events keep their own settings. Older
browser-only presets remain available.
Use **Add New Shot** at the bottom of the left library to create a fresh preset.
Right-click a library row, or use its three-dot menu, to delete it from the
library permanently, including a system default.
Playback follows the opponent while accelerating and braking between your configured shot views.
Opponent returns wait for a supported contact height instead of lifting the model.
If an apex is too high, contact moves to descent along the same ball flight, with
movement and swing timing fitted to that later hit. See the
[grounded contact contract](decisions/0050-grounded-opponent-contacts.md).
For rally shots, final footwork adjusts each view within its contact neighborhood to meet the real
incoming ball on the configured racket side, retaining your viewing direction.
Opening serves keep their configured launch speed (including shot variation) and
hold the exact authored return camera through the toss, serve and player contact.
The illustrative player return adapts to the serve; it cannot slow the serve or
recenter the view. Between-point camera moves finish before the next toss.
Impossible serve speed/zone combinations are reported instead of slowed down.
See the [opening serve contract](decisions/0052-opening-serve-authority.md).
The editor labels isolated contact estimates; **Preview actual shot** shows the
selected shot with its gameplay movement and contact. See the
[contact-camera investigation](development/player-contact-camera-2026-09-12.md).
Select the narrow **camera event between shots** to configure movement and focus
independently. Keep Automatic, recover to neutral, travel directly, or stop at a
custom position. Choose departure/continuation timing and separate focus targets
before and after opponent contact. WASD and dragging frame an intermediate view;
**Capture position** and **Capture direction** save it without changing the shot's
contact camera. Preview a single transition or the full sequence. Camera transitions
travel with saved shots, survive reload and mirror for left-handed play; zoom
remains shared across the drill. See the [camera transition guide](development/camera-transitions-2026-09-10.md).
Drill shots independently choose player/opponent contact timing:
on the rise, at the apex, or early descent (the default). The interval solver fits
within that phase; it does not switch to a quick rebound to meet a short interval.
After an opening serve, the illustrative player return instead chooses the legal
contact nearest the authored racket anchor, preserving the incoming serve.
Quick Rally retains its opponent timing preference; Quick Practice player returns
choose their shot family and contact automatically.
Volleys/overheads stay in the air and half-volleys stay just after the bounce.
Player volley and half-volley contact-height preferences follow **Eye height**;
actual playback still meets the incoming ball. Both sides use direct net-shot
arcs, with flat/downward high volleys and necessary lift on low contacts.
Saved higher net clearance and **Exact speed & spin** still apply. See the
[net-shot planning contract](decisions/0049-camera-relative-net-shot-planning.md).
Bounce factor **1.0** uses the shared calibrated court response for both players:
the hard reference passes the standard ball-drop range, and angled impacts retain
more rebound height while accounting for court grip and spin. See the
[bounce calibration and limits](development/ball-bounce-research-2026-09-11.md).
Calculation runs in a cancellable worker. Impossible links are reported before
playback. Old drills convert by physical role and original browser data is retained.
See the [player-first drill contract and verification](development/player-first-drills-2026-09-09.md).

**Player handedness** in Drills and Editor mirrors cameras, opening positions and
both landing zones for left-handed play. Shot names and the opponent's configured
hand are retained. The choice persists across drills and reloads; saved shots adapt
once when reused in either orientation. See the
[mirroring contract and verification](development/player-handedness-2026-09-09.md).

**Perspective → Ball highlight** makes the incoming ball lighter and more luminous
as it approaches. It changes only the ball's material; trajectory lines and landing
zones retain their normal appearance. The scene renders directly with no focus blur
or postprocessing. The optional toggle stays shared across Practice, drill editing
and playback, and preserves existing on/off choices. See the
[ball-only highlight decision and verification](decisions/0027-ball-only-highlight.md).

The net uses filtered thread coverage in both Quality and Performance modes, so
wide views and zoom changes retain the weave. Authored sag, tape and posts remain.
See the [net rendering decision](decisions/0028-filtered-net-weave.md).

Renderer diagnostics are available with `?profileRenderer=1`, including the actual
GPU, drawing-buffer size, CPU stages and asynchronous GPU time. See the
[performance investigation](development/renderer-performance-2026-09-08.md).
