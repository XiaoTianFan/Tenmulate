# ADR-0042: Independently authored camera movement and focus

- Status: Accepted for local implementation
- Date: 2026-09-10
- Supersedes: The automatic-only camera policy in ADR-0041. That decision's
  tennis stages remain the default; contact anchors and fixed zoom remain binding.

Each player event may own an optional `cameraTransition` for the interval after
its contact and before the next player contact. A narrow camera column between
timeline shots selects that configuration. It moves with its preceding shot
when reordered, duplicated or saved as a preset. It refers to the current next
shot rather than a stored event id. A final event retains its transition for reuse
but does not invent another shot. Transitions also apply between separate points.

Movement and focus are independent:

- Movement routes are Automatic, neutral recovery, direct travel to the next shot,
  or a stop at an authored intermediate position followed by the next shot.
- Explicit routes select departure and continuation relative to the player hit,
  opponent contact or split-step completion, each with an optional delay. Timing
  and pace can remain Automatic. Automatic timing starts a recovery after the
  player's release, resumes after the split, and starts direct travel after the split.
- Both route legs use quintic acceleration/braking. Pace selects the preferred
  duration; the physical fit may compress it within existing speed/acceleration
  limits. An impossible stop is reported, not skipped, teleported or solved by
  retiming a ball in flight. Existing ball/contact phase constraints remain intact.
- Before and after opponent contact, focus independently selects Automatic,
  actual ball, actual opponent, next-shot direction, fixed direction or a court
  point. Explicit tracking can leave the opponent out of frame. Changes blend at
  contact and yield to the next authored shot view before the player's contact.
- Automatic route and focus choices reproduce ADR-0041. Explicit choices may
  anticipate the next return intentionally; that exception does not change the
  default causal behavior.

The editor uses a temporary camera while a transition is selected. WASD, dragging
and wheel input remain available. Capture position stores only lateral position,
baseline depth and eye height; capture direction stores only yaw/pitch. A court
point can be taken from the view ray or adjusted as coordinates. These operations
do not overwrite the outgoing or next shot's contact camera. Wheel zoom still
changes the whole drill. Top-down view is temporary and cannot be captured as a
player-height waypoint. Isolated shot editing continues to use its normal camera.

The optional schema-V2 field is preserved through local storage, snapshots and
presets. Missing fields require no migration and mean Automatic. Validation rejects
unknown fields, invalid choices, missing custom targets, non-finite coordinates
and out-of-range timing. Player handedness mirrors waypoint lateral position,
direction yaw and focus-point x; opponent handedness and timing are preserved.

Playback remains pure clock sampling with the actual outgoing/incoming trajectories
and animated opponent. Preview, seek, reduced motion and gameplay consume the same
track. Camera focus does not change physical contact timing. FOV is never animated.
The player planner identifier is `gameplay-player-drills-v14`; the physics solver,
opponent assets and Quick Practice camera are unchanged.
