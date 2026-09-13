# ADR-0054: Rally feasibility before variation preference

- Status: Accepted for local implementation
- Date: 2026-09-13
- Supersedes ADR-0040's fixed sampled-target requirement for Quick Rally only.
  Retains its physical solver, pace bounds and explicit Exact behavior, and
  ADR-0050's grounded opponent-contact requirement.

## Prerequisites and constraints

A rally link requires a legal incoming ball, a real eligible player contact,
a return crossing the net and landing in the blue zone, a supported grounded
opponent intercept, sufficient movement/preparation time, and a legal outgoing
ball with another eligible player contact. Validate these together before
accepting the link. Never create a source by snapping, retime a physical flight,
lift the opponent, move the camera, or expand the configured landing zones.

Shot variation selects preferred candidates within constraints; a failed random
point is not evidence that the entire configuration is impossible. An explicit
point zone remains a point. Opponent family, configured contact phase (subject
to the existing grounded-contact postponement), stroke choice, surface, wind,
clearance and the existing Natural/Exact physics rules remain authoritative.

Quick Practice authors only the player return's blue zone. Its hidden player
shot defaults therefore use `playerShotPolicy: automatic`. If necessary the
planner may search the supported player shot families, spins and contact phases.
Explicit drill/API configurations default to `configured` and retain their
selected player shot and phase. The accepted return configuration is recorded
with the repetition. No new user settings or persisted schema are required.

## Search and playback

Try the preferred contacts and randomized landing point first. If rejected,
search every eligible integrated player sample, ranked by contact preference,
and deterministic alternative points within the return zone. If needed, also
vary the next opponent landing point inside its configured zone. Only after
these searches may automatic player-shot preferences change. Natural fitting
continues searching its existing pace/spin space; interval fitting cannot
manufacture a lob or violate a real contact clock.

Opening/feed validation likewise searches alternative landing points when the
randomized point cannot provide a legal receivable ball. Setup, finite sessions,
streamed batches, worker preparation and synchronous fallback share the compiler.
Return candidates stop at the first fully acceptable flight during the expanded
search. Accepted links carry the exact trajectory already checked, rather than
re-solving after committing to an intercept.

This is a bounded numerical search, not proof over continuous real numbers:
every eligible integrated contact sample is available, zone coverage uses the
random point plus a 5-by-5 grid, and flight fitting uses the existing bounded
physics search. An exhausted search reports that no connection was found within
the constraints; it must not claim mathematical impossibility. Zones wholly
outside the opponent court fail the prerequisite check immediately.

The opponent-feed planner version is `gameplay-opponent-footwork-v16`.
Physics and player-drill planner versions and motion assets are unchanged.
