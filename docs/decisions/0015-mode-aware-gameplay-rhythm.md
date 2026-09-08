# ADR-0015: Mode-aware gameplay rhythm and rally planning

- Status: Accepted for local implementation
- Date: 2026-09-08
- Supersedes: The mandatory recovery and fixed-rate gameplay timing portions of
  ADR-0014 and the prior local motion runtime contract. Asset/model decisions and
  the motion-production boundary remain in force.

The owner's gameplay objective requires a stationary practice anchor, tactical
recovery choices for drills, time-dependent receiver coverage, physical return
flights, and relative rhythm controls.

The session compiler owns contact times, animation rates, recovery decisions,
receiver assessments, return flights and rests. The renderer and audio sample
that compiled clock. Quick Practice returns to its selected home after each shot.
Drills recover when time permits, or travel directly when it does not; serve-and-
volley moves forward directly. A selected route is retained after solving the ball.

Rhythm is 50–150%, with 100% derived from authored motion, bounded travel and
estimated rally flight time. Uniform source-clock scaling is bounded to 0.85–1.2.
Normal and compact serves remain distinct clips. Ball speed is independently
authored; it is never multiplied by the rhythm setting. Legacy interval fields
remain importable and map to a bounded percentage when no percentage is present.

Returns use the same drag, spin and bounce integrator in the reverse direction.
An inverse solve must fit the next shot's contact time and position, clear the
net, obey bounce rules and keep speed within 0.65–1.35 of the preceding launch.
Unreachable or infeasible links are explicit new feeds. This preserves the
authored next shot instead of silently moving the racket or warping the ball.

Validation must cover deterministic seeks, movement continuity, both-handed
contacts after real blending/IK, legal return handoffs, migration, and visible
setup/rehearsal/editor flows. Local verification does not imply owner acceptance
or public deployment.
