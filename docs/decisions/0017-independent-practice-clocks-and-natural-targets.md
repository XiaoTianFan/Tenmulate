# ADR-0017: Recovery-centered practice, independent clocks and natural targets

- Status: Accepted for local implementation
- Date: 2026-09-08
- Supersedes: Practice position and coupled rhythm in ADR-0015; exact-speed-only application feeds in ADR-0016.

The selected practice opponent position denotes a recovery center. Forehand and
backhand preparation points lie a short step to either side in the opponent's
frame. Ball contact is derived from that body position and the loaded clip's
racket anchor; the desired landing point stays fixed. Serve practice retains its
service start without lateral approach steps.

Shot interval, stroke rhythm and preferred movement pace are separate inputs.
The planner can accelerate travel within a bounded envelope to meet an interval,
but extends a physically impossible interval and reports the effective value.
Long intervals permit waiting without slowing the stroke. Stroke source time and
distance-based gait time remain deterministic and independently seekable.

Ordinary trajectory resolution follows the low-angle range branch. Natural mode
can adjust requested launch speed by up to 15% and spin by up to 20% to preserve
the landing target and avoid excessive arcs. Exact mode retains requested speed
and spin. Resolved values and infeasible targets are visible. Lob retains its
deliberate high-arc family; overhead is not a lob.

The first-bounce handle exposes separate direction and depth axes. Dragging a
handle owns the pointer until release and cannot also rotate the camera.

Research and empirical verification are recorded in the current development
contract. Numeric movement and adjustment envelopes are product calibrations,
not measurements of the owner's abilities.
