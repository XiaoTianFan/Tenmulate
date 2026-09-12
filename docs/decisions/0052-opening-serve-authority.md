# ADR-0052: Preserve opening serve pace and the authored return view

- Status: Accepted for local implementation
- Date: 2026-09-12
- Supersedes: ADR-0048 contact-camera adjustment and automatic opening camera attention for opponent opening serves only. Rally footwork, continuous ball contact, normal exchange focus and custom between-point routes remain.

## Problem

The edited Crosscourt serve returns drill exposed two coupled overrides. The
incoming fitter searched slower serves to satisfy the first player event's
contact neighborhood and bounce phase. Natural trajectory fitting could reduce
speed again to reach a sampled target. With variation disabled, requested speeds
130, 150 and 173 km/h resolved to 104, 114.75 and 102.935 km/h respectively.

The planner then shifted the camera to the calculated racket contact. In the
173 km/h reproduction it moved approximately 1.37 m sideways and 0.30 m backward.
Automatic attention changed yaw and pitch, while split-step compression changed
eye height. The isolated authored opening and actual sequence consequently gave
different views of the same serve.

## Decision

An opponent opening serve is authoritative. Apply configured shot variation once,
then preserve that launch speed through trajectory fitting. Natural mode may
still fit launch angle and bounded spin; Exact mode preserves spin too. If the
speed, landing zone, spin and clearance cannot form a legal serve, report a
planning issue rather than reducing speed.

Select the illustrative first player response from legal contacts for its shot
family, nearest the authored racket anchor. This exception ignores the usual
contact-radius and preferred bounce-phase filters: the camera describes where
the user wants to practice reception, and the pseudo response must not reshape
the incoming serve. The response still starts at the physical incoming contact,
without changing the ball's position or clock. Its landing zone and shot settings
remain configured. An incompatible return family produces a planning issue.

Hold all authored camera components through service preparation, the incoming
serve and first player contact. Do not apply contact stance correction, automatic
opponent/ball panning or split-step eye compression. This applies to initial and
subsequent point openings, isolated opening previews, sequence preview and launched
drills. The existing global camera-motion override remains available.

Keep custom between-point movement and focus. Schedule the next serve's toss
after that route and focus transition finish; additional waiting is preferable
to moving the reception camera during a serve. Normal movement may resume after
the player return. Opening controls display resolved launch speed and explain
variation and the fixed return view.

Versions: `ball-v12-opening-serve-pace`, `gameplay-player-drills-v21`.

## Verification

- Full suite: **631 tests / 60 files**. Both hands preserve 100, 130, 150 and
  173 km/h, with decreasing arrival times and legal landings in the reproduction.
  At 240 Hz, every camera component remains identical from service preparation
  through player contact. Tests cover real contact continuity, isolated/sequence
  parity, player phase/pace independence, variation and infeasible speed reporting.
- Existing custom-route tests now verify completion before the next serve's toss,
  retaining authored route and focus behavior.
- Production build, TypeScript and active motion/precache guard pass.
- Actual Edge editor controls changed opening speed from 130 to 173 km/h with
  variation off; resolved speeds matched exactly. Preview Sequence and launched
  Test drill both retained the authored lateral position, baseline distance,
  eye height, yaw, pitch and FOV through the serve and player return. No browser
  errors occurred. Existing WebGL shader warnings were unchanged.

Local evidence directory:
`C:/Users/20378/.codex/visualizations/2026/09/12/01a09414-f625-7dd2-ba82-d570264839e1/serve-opening/`.
It contains before/after probes, UI results and editor/playback screenshots.
Saved project catalogs were not changed by this fix. Local implementation and
rendered verification are complete; owner acceptance and public deployment remain
separate gates.
