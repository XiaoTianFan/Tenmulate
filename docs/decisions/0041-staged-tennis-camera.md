# ADR-0041: Contact-driven tennis camera stages

- Status: Accepted for local implementation
- Date: 2026-09-10
- Supersedes: The player-hit-to-next-view travel rule in ADR-0022 and ADR-0037.
  Retains player-owned events, physical contact anchors and deterministic clocks.

The player-first drill camera must not reveal the next return before the opponent
hits. It follows tennis decisions rather than interpolating directly from one
authored event to the next. Preview sequence and gameplay consume the same track.
Isolated shot editing keeps direct camera controls.

1. Hold the authored view briefly through the player's stroke.
2. Recover toward a semi-central ready position using the known outgoing ball's
   angle. Move only as far as the outgoing flight permits. A net player retains
   net-ready depth. Watch the actual animated opponent during this stage.
3. For an intentional approach, advance early in depth. The next shot must be
   substantially farther forward and be an approach/volley, follow an approach,
   or follow a ball that pulls the opponent wide. The forward curve may continue
   through the split step. Lateral coverage still uses the outgoing ball, not
   the future return's destination.
4. Around opponent contact, show a small split-step eye compression and a short
   reaction interval. Only then travel toward the next authored contact position.
5. During the incoming flight, blend attention toward the actual ball. Soften
   panning near the framing limit to retain opponent/court context. Do not chase
   a near ball out of the view or zoom to contain both subjects.
6. Settle into the authored position, yaw and pitch before the player's next hit.
   This makes editing and physical contact placement predictable. The author
   controls the contact frame; tracking controls the intervening experience.

Horizontal FOV remains fixed for the entire playback. Old per-event values are
resolved to the first event's FOV without modifying saved source data. Editing
zoom updates every event in the editor copy; inserted shots inherit that FOV.
Temporary top-down editing remains independent.

Position legs use quintic easing with zero endpoint velocity and acceleration.
An approach has a separate continuous forward curve, avoiding a forced stop in
every axis. The post-contact fit checks travel time under bounded speed and
acceleration. Real trajectory/contact fitting supplies that time where possible;
it must not solve a short window by starting lateral travel before contact,
retiming the ball, moving the saved camera, or changing the selected bounce phase.
An impossible authored link still reports a planning issue.

The camera is a pure function of session time, compiled stages, actual opponent
root, incoming trajectory and viewport aspect. Pause, seek, replay and frame rate
do not accumulate camera lag. Reduced-motion scaling applies after sampling and
does not change contacts, trajectories, timing or opponent movement.

The reaction interval, eye dip, speed limits, easing and attention blend are
game presentation choices. They are informed by tennis evidence, not claimed to
reproduce an individual player's measured head or eye motion. Gaze is not the
same as a camera's optical axis. See the [research and validation record](../development/tennis-camera-research-2026-09-10.md).

The player-first planner identifier is `gameplay-player-drills-v13`. Legacy
opponent-first camera tracks retain their adapter. Quick Practice's stationary
camera, motion assets, opponent hand and saved content schema are unchanged.
