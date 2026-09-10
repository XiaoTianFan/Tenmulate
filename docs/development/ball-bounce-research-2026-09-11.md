# Ball rebound calibration — 2026-09-11

## Finding and evidence

The low rebound was in the shared forward physics, not a separate player-return
renderer. The previous hard-court COR was 0.67, with a small impact-speed correction.
A vertical 2.54 m drop produced only **1.059 m** rebound. The rigid-sphere friction
model also converged to 0.645 horizontal speed retention for an unspun gripping
impact, omitting deformation and elastic grip.

- [ITF 2026 technical booklet](https://www.itftennis.com/media/15639/2026-technical-booklet.pdf),
  printed pages 5 and 11: Type 2 rebound is 135–147 cm; TB 04/01 drops the ball
  from 254 cm onto a smooth, rigid, heavy block. Both heights are measured to the
  **bottom** of the ball. This is a reference-ball check, not a promise that every
  court rebounds to the same height.
- [Cross, 2003, Measurements of the horizontal and vertical speeds of tennis courts](https://www.physics.usyd.edu.au/~cross/PUBLICATIONS/23.%20CourtSpeed.PDF),
  pages 94, 96–98, 102–106: oblique impacts often have greater vertical COR than
  drops (typically 0.8–0.9 in the cited court measurements). The normal force can
  act ahead of the ball centre; reported offsets span approximately 4–11 mm.
  Tangential restitution around 0.1 describes modest elastic grip. The paper
  explicitly cautions that measured data do not cover every speed, spin or court.
- [Cross, Measurement of the speed and bounce of tennis courts](https://www.physics.sydney.edu.au/~cross/PUBLICATIONS/52.%20SpeedAndBounce.pdf),
  pages 2–4: vertical drops and oblique court tests serve different purposes;
  spin, gravity and drag matter when extrapolating camera measurements to impact.

The incoming apex and rebound apex should not be forced to a fixed ratio: drag,
spin, incidence angle and surface all affect the vertical speed reaching the
ground and the subsequent flight. A correct default must nevertheless reproduce
a credible reference drop and angled collision.

## Implemented model

`courtBounce.ts` owns one collision response used by `integrateTrajectory`, for
player balls, opponent balls, editor previews and full gameplay. Gravity, airborne
drag/lift, source clocks and inverse-solver arc preferences are unchanged.

The normal response is an effective calibrated approximation:

```
e = clamp(reference + clamp(0.012 * (7 - normalSpeed), -0.12, 0.07)
          + obliqueGain * horizontalSpeed² / totalSpeed², 0.5, 0.93)
```

| Surface | Reference COR at 7 m/s | Oblique gain | Normal impulse offset |
| --- | ---: | ---: | ---: |
| Hard | 0.775 | 0.085 | 7 mm |
| Clay | 0.780 | 0.120 | 9 mm |
| Grass | 0.650 | 0.055 | 3 mm |

These are representative product calibrations, **not** a claimed exact fit to a
particular measured venue. The hard reference includes the existing air drag when
matching the ITF drop. Clay remains higher/slower; grass lower/faster. The offset
fades continuously for nearly vertical impacts. Existing friction coefficients
and rolling resistance remain in force.

The impulse calculation retains the 0.55 spherical-shell inertia factor. It adds
the torque from the forward normal impulse, then solves a tangential impulse for
contact-point restitution 0.1, bounded by Coulomb friction. Translation and spin
change together; there is no independent spin boost. The representative unspun
20 m/s horizontal, 7 m/s downward impact falls within the observed broad oblique
restitution/speed-retention envelope. A 375-case grid checks non-increasing total
translational plus rotational kinetic energy at the natural factor, including
backspin, high topspin, steep and grazing impacts on all three surfaces.

Bounce factor **1.0** selects this natural response. The existing 0.6–1.4 control
still scales first-bounce vertical velocity only. It is an explicit practice
override, not a height ratio or a calibrated ball-pressure setting; factors above
one may deliberately exceed passive restitution. Subsequent bounces use the
natural model. First-flight launch, net crossing and first landing are unchanged
for a fixed launch when the factor changes.

Quick Rally previously discarded opponent contacts beyond 3 m behind the baseline,
while drills allowed 5 m. Both now use `CONTACT_COURT_LIMITS` (5 m run-back and
2.5 m lateral run-off). This permits genuine later contacts on deeper rebounds.
Height, selected phase, second-bounce exclusion, reaction and movement feasibility
remain constraints. No camera reach, motion-speed limit or contact phase was relaxed.
Recompiled plans identify physics as `ball-v10-court-bounce`.

## Measured comparison

Same requested 70 km/h Natural ball, source `(0, 1.05, 12.5)`, target
`(-1, -9.5)`, hard surface, 1 × 1 m zone, factor 1. These isolated flight checks
have no receiving predicate. Launch speed/spin, flight apex and first landing are
identical before and after; the table measures ball-centre rebound heights.

| Ball | Resolved speed / spin | Flight apex | Old rebound | New rebound |
| --- | --- | ---: | ---: | ---: |
| Flat | 86.625 km/h / 0 rpm | 2.285 m | 0.779 m | 1.239 m |
| Topspin | 86.625 km/h / 138.75 rpm | 2.335 m | 0.801 m | 1.280 m |
| Slice | 84.875 km/h / 720 rpm | 2.167 m | 0.694 m | 1.103 m |

The independent drop-to-bottom measurement changes **1.059 → 1.398 m**.
These are regression fixtures, not universal rebound-height targets. In connected
rallies, the existing solver can select a different flight to preserve the chosen
receiving contact, so compare that whole exchange separately.

## Verification

- `court-bounce.test.ts`: reference drop, oblique response, energy, mirrored player
  and opponent paths, unchanged first flight across factors, grazing continuity
  and surface ordering.
- Existing trajectory, return-flight, Quick Rally, every shipped player drill,
  contact-phase combinations and both-hand post-IK/continuous-preview checks pass.
- Full suite plus the corrected new fixture: **565 tests / 53 files**. Production
  build and active motion/cache integration guard pass.
- Actual `TennisScene` review: return apex 1.505 m at 6.567 s, opponent contact
  1.383 m at 6.717 s. Calculated/rendered ball positions coincide; both-hand racket
  contact errors are below 0.002 m. The contact remains on early descent, 0.15 s
  after the apex. Review uses the shipped rig, blending and IK, not a clip viewer.
- Rebuilt production Quick Practice completes the retained deep-zone rally setup
  at factor 1 with no console errors or connection warning.

Ball wear, pressure, temperature, court moisture and location-dependent surface
variation are not modelled. Empirical impact parameters remain an approximation;
local implementation and rendered checks are not physical court validation or
owner acceptance.
