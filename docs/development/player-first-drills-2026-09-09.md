# Player-first drill planning — 2026-09-09

## Contract and authoring

[ADR-0037](../decisions/0037-player-first-drill-planning.md) replaces opponent-owned
drill events with `DrillDefinitionV2` and `PlayerShotEventV2`. Quick Practice retains
its opponent-feed contract. The drill library now contains 16 player-authored
patterns and 21 player shot presets; forehand, backhand, crosscourt and down-the-line
names describe the player. Presets assume a right-handed player; explicit hand,
stroke, camera and zone edits remain independent.

| Concept | Current owner and behavior |
| --- | --- |
| Opening | Opponent feed or serve, explicit body position, ball settings and yellow landing zone |
| Player event | Player camera, hand/stroke, ball speed/spin/type, blue far-court landing zone |
| Opponent return | Independent response ball and yellow near-court landing zone for the next player action |
| Opponent position | Resolved from the player flight; authored only for openings |
| Interval | Requested time between consecutive player contacts |
| Repetitions | Player actions; opening feeds are excluded |
| Set/point end | Last player shot completes the point; an extra opponent stroke is not generated |

The opening chip is selectable independently of the numbered player timeline.
An explicit new-point prelude can also precede an individual action, supporting
consecutive serve-return exercises. Each prelude has its own opening chip and
editable yellow zone. The primary opening repeats at a set boundary; repetitions
may finish partway through the final sequence.

The left library supports type/source filters and drag/drop. The timeline supports
insertion, reordering and right-click/Delete removal. The inspector groups player
identity, ball parameters and rhythm in **Player shot · blue zone**, followed by
**Opponent return · yellow zone**, **Perspective**, and **New point**. The opponent
response has equivalent independent ball controls. Kick and sidespin are available only for opening serves, with Normal or
Compact rhythm. Suggested-opening and aim-at-next-shot actions explicitly help
reconnect an edited sequence. Saved shots capture both balls, zones, camera and
materialized timing defaults; updating a preset preserves its identity.

## Physical compilation and rendering

`compilePlayerDrill` produces `playerEvents`, `scheduledFlights`, opponent motion
records and one camera timeline. Flight ownership alternates:

```text
opponent opening -> your shot 1 -> opponent return -> your shot 2 -> ... -> point end
```

`courtFlight` rotates the existing aerodynamic solver into the player's direction,
including velocity, wind and flight-event coordinates. Landing samples and speed/
spin variation use independent seeded streams. Searches keep each sampled landing
point fixed, preserving uniform area sampling instead of rejecting difficult draws.

The camera anchors a small physical racket-contact neighborhood, with a 0.45 m
stroke/hand offset and 0.65 m forward offset, bounded to a 1.4 m horizontal reach.
The launch must also lie on the incoming trajectory and satisfy the selected shot
family's contact phase and height. Eye height and look direction do not relocate
the physical ball. Player volley eligibility includes high volleys up to 2.05 m.

The opponent meets the actual player flight. Motion feasibility is filtered before
reducing the expensive trajectory search, retaining narrow legal contact windows.
The planner favors a comfortable contact and excludes contacts below the visible
rig's supported envelope (0.65 m ground strokes, 1.1 m volleys, 2.2 m overheads).
This avoids sinking the mannequin through the court to prolong an interval.
Net-practice presets use softer volleys and sufficient clearance on approach,
half-volley and short-angle balls to leave playable bounces and travel time.

Both balls own an optional `contactTiming` (`rise`, `apex`, `descent`), which means
the phase of the incoming ball at that actor's next stroke. Missing values resolve
to early descent. The shared bounce-contact helper constrains candidates to the
chosen phase of the first bounce and ranks them near its preferred time. Apex uses
the small vertical-velocity window around the physical maximum; descent prefers
just after that window. Air shots bypass bounce timing and half-volleys always use
the rising phase. Player and opponent choices are independent; a shorter interval
cannot switch either choice to an earlier phase or retime a flight.

Quick Rally uses the same helper, with player timing in the blue return settings
and opponent timing in Ball & rhythm. Its bounded search deduplicates player contact
samples within 0.1 seconds to avoid fitting nearly identical trajectories. The
shared resolver also considers receiving contacts and, when necessary, movement
feasibility while selecting the physical flight. It tries neutral spin at the
requested pace before changing pace; outer groundstroke searches cannot lower
pace merely to fill an interval. The full motion-rate fit uses the chosen real
contact. Remaining impossible combinations report their physical limit; zones,
cameras and selected phases are not silently moved. See [ADR-0040](../decisions/0040-neutral-groundstrokes-and-contact-fitting.md)
and the [research receipt](groundstroke-flight-research-2026-09-09.md).

Generated receiving zones account for the requested phase, racket side and the
incoming crosscourt direction's continued movement after the bounce. Default
short-angle and half-volley profiles leave sufficient height for a descending
opponent contact. These are new-preset/suggestion calculations; editing a timing
choice never moves an existing zone or camera. The selected-shot view still previews
its two outgoing balls in isolation; Preview sequence applies the player's timing
to its preceding incoming ball and validates the complete exchange.

Shared source-clock motion, prepared entry after a traveling unit turn, rigid
grips, fixed bone lengths and recovery/direct-route selection remain in force.
The camera now has stroke, recovery/approach, split, receive and settling stages.
Ordinary recovery follows the known outgoing shot's coverage angle; the camera
watches the actual opponent and waits until after contact to move toward the
next lateral destination. Intentional approaches can advance early in depth.
During reception, bounded ball tracking keeps opponent/court context, then restores
the authored contact view. FOV stays fixed for the drill. Camera comfort scaling
changes only presentation, preserving all ball contacts and times. See
[ADR-0041](../decisions/0041-staged-tennis-camera.md) and the
[research record](tennis-camera-research-2026-09-10.md).

The final player action ends its point. Its response configuration stays in the
saved event for later insertion/reordering, but is not played without a following
player action. Set rests and new openings are explicit boundaries. No ball endpoint
snaps, time warps or invisible replacement feeds are used.

The module worker handles editor previews, starting a drill and new variations.
Selected-shot editing uses an isolated compilation mode: the player starts at the
configured racket anchor, and the opponent meets that physical flight at a legal
bounce/contact phase. Both paths stay visible in their zone colors throughout the
local animation. The preceding incoming shot is not shown beside the selected
event's future response zone. Even a final event previews its reusable response;
full sequence playback still ends at the final player action.

This editing preview is independent of reachability elsewhere in the drill. The
full sequence compiler remains authoritative for actual incoming-contact positions,
interval fitting, motion travel and camera continuity. It can reject an unreachable
link while the selected shot remains editable. An impossible local response is
reported without substituting an old flight or moving a bounce marker into the zone.

Zone gestures update meshes immediately and send transient drafts to the isolated
worker after a 75 ms quiet period; release commits the drill and starts its full
validation solve. Committed shot changes start the isolated solve without the old
180 ms full-drill debounce. Obsolete jobs terminate, and publication checks include
drill identity, surface and selection. Old balls, paths, markers and tooltips hide
while an updated shot is pending; the court, zones and camera stay mounted and
interactive. Bounce markers use actual flight events and matching authored zone
bounds, independently of whether those bounds were supplied by the editor.

## Persistence and migration

Canonical app data uses schema 2 at `tenmulate.appData.v2`. The loader reads the old
`tenmulate.appData.v1` key only when the new key is absent; original bytes are never
overwritten by the migration. Existing practice and camera preferences are retained.

For an old drill, the first incoming shot becomes the opening, each pseudo-return
becomes a player action, and the following incoming shot becomes its opponent
response. Court and camera coordinates are preserved by role, not mirrored.
Additional old serves become explicit point openings. Legacy names use “Reply to”
to avoid claiming an opponent's old forehand was the player's forehand. Invalid
legacy records remain in the original key, with a startup notice that repair is
needed. Strict schema 1/2 JSON import rejects invalid conversions before storage.
New presets and drills round-trip without inheriting settings from another drill.
Older schema-2 balls and saved shots gain the descent default on load, while
explicit timings and all authored coordinates are retained. Timing is captured by
new-shot snapshots and saved-slot overwrite, as well as Quick Practice preferences.

Migration preserves the authored data, not a promise that every old sequence can
form a continuous physical rally. The editor reports the first unreachable link.
The player cannot start an incomplete requested sequence; adjust its preceding
zone, shot type, pace or next camera, or explicitly start a new point.

## Practical limits

This is simulated tactical rehearsal, not body-tracked racket contact. Authored
camera positions must remain near the actual incoming ball. Shot intervals are
search targets constrained by both physical flights, camera travel and mannequin
preparation; the editor displays the resolved contact interval when it differs.
An arbitrarily slow interval cannot be created by holding a flying ball in place.
Exact speed/spin settings may be unreachable. Extreme custom combinations and
other variation seeds may need authoring adjustments; they do not silently become
new feeds. No motion asset or public deployment is part of this change.

## Verification

- 428 tests across 43 files pass, including 36 session tests for player-first
  continuity, camera travel, timing, determinism and invalid-link reporting.
  All 16 bundled drills complete two sets with seed 18427; a separate browser
  probe completes all 16 with seed 18428. Content and storage checks cover strict
  imports, role-preserving conversion, original-byte retention and idempotent reload.
- TypeScript and the production build pass, including the active motion/cache
  guard. The existing large-chunk build advisory remains. The shared 25-clip
  opponent bundle and its provenance were not modified.
- Production Edge passes 42 desktop/mobile checks: independent ball identity and
  parameters, both zones and resizing, no mid-gesture compilation, WASD, library
  filtering/drop, timeline removal/undo, saved-shot overwrite, reload, migration,
  separate point openings, player counts and shared-renderer continuity.
- Actual rendered checks cover 72 both-hand approach/entry/contact frames across
  four representative drills, with maximum contact error 0.000001103 m and
  bone-length change 0.000000220 m. Minimum sampled pelvis/knee heights are
  0.544/0.151 m. Authored contact views and opponent tracking during camera travel
  pass. Representative editor, mobile, serve-opening and contact images were
  visually inspected; no browser runtime errors were observed.

Scripts, measurements and screenshots are under
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/player-first-drills/`.
The [visual ledger](visual-verification.md#player-first-drill-editor-and-playback--2026-09-09)
names the final probes. The original browser tab was preserved. Local verification
does not claim owner acceptance, exhaustive custom-combination coverage or deployment.
