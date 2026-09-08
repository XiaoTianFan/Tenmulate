# ADR-0018: Uniform landing zones and continuous scene preview

- Status: Accepted for local implementation
- Date: 2026-09-08
- Supersedes: Fixed landing points and screen-level landing controls in ADR-0017.

Every Quick Practice family and drill event defines a court-aligned rectangular
landing zone. Existing target coordinates become zone centers. Missing dimensions
default to 1.6 × 2 m, or 0.9 × 1.2 m for serves. Editable dimensions are 0.2–6 m.
Intersect the rectangle with the receiving singles court or diagonal service box
before sampling independent uniform X and Z coordinates. Do not clamp sampled
points, reject/resample inconvenient targets, or silently concentrate them at an edge.

Landing, launch speed, spin and timing use separate seeded random streams. The
speed/spin control defines uniform relative variation (0–25%) within the supported
parameter ranges; zero parameter variation still samples the landing zone.
Launch direction and elevation are solved for each sampled landing. Natural mode
first tries the existing ±15% speed neighborhood, then allows up to ±50% for zone
fits that need it (notably short half-volleys). Spin adjustment remains ±20%.
Exact mode fixes the sampled speed and spin.
Resolved parameters need not remain uniformly distributed after fitting. Infeasible
combinations remain explicitly marked, rather than being represented as successful
uniform landings. The compiler planner version advances to `gameplay-rhythm-v3`.

The zone, center, bounce marker and translation arrows are Three.js geometry in
the rendered scene, with perspective and depth testing. Red X and blue Z arrows
follow court coordinates. Raycasting selects them; a plane containing the selected
axis converts pointer motion into metres. Pointer capture prevents simultaneous
camera movement. Configuration fields edit dimensions, while a white ring locates
the displayed trajectory's actual bounce. The drill editor provides a raised,
rotatable preview camera to inspect zones near the court edges.

Quick Practice setup streams six-feed batches indefinitely, independent of planned
set length and rest breaks. New batches receive fresh deterministic seeds. The
shared recovery planner schedules each batch boundary on one absolute clock,
retaining previous balls and upcoming preparation. The renderer retains a bounded
three-batch window. Starting practice compiles the requested finite set, including
its repetitions and rests; changing the setup rest/count fields affects that set.

The active motion asset, IK/contact constraints and finite drill rally planner
remain their own authorities. Rally returns are solved against each newly sampled
outgoing flight and the next actual racket contact. Local implementation and
automated/browser verification are separate from owner acceptance and deployment.
