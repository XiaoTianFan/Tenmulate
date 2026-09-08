# Practice movement and trajectory design — 2026-09-08

## Source findings

- [Filipčič et al., movement before/after the split step](https://pmc.ncbi.nlm.nih.gov/articles/PMC5304280/)
  investigates deceleration before and acceleration after the split step across
  stroke and player groups. [Armstrong et al., lateral end-range movement](https://pmc.ncbi.nlm.nih.gov/articles/PMC11730432/)
  studies braking, reacceleration and recovery in match tracking. These support
  modelling arrival, braking and recovery as movement phases rather than using
  constant translation or treating ball speed as running speed. Search-indexed
  abstracts were available; the full PMC pages challenged automated access.
- [Daniel Holden, Spring-It-On](https://theorangeduck.com/page/spring-roll-call)
  describes character velocity and acceleration as separate signals, including
  analytic future evaluation. We use a finite-duration, analytically integrated
  speed curve instead of a stateful spring, because a drill needs exact arrival
  times and deterministic backward seeks.
- [Crawford Lindsey, TWU shot definitions](https://twu.tennis-warehouse.com/learning_center/trajectory_info.php)
  explains how launch speed, angle and spin jointly affect depth, including
  examples of trading speed and spin for the same depth. This supports explicit
  control priorities; it does not prescribe our numeric adjustment bounds.

## Diagnosis and decisions

The previous directed solver ranked every elevation by landing error. Ballistic
range is non-monotonic in elevation, so nearby inputs could select different
roots: the supplied images show 58°/10.84 m apex versus 27.8°/4.22 m at 70 km/h.
This is a branch-selection fault, not evidence that gravity or Magnus forces
should be weakened. Ordinary shots now stay on the ascending-range low branch.

Natural mode first tries the requested speed and spin. If that gives excessive
elevation or misses the target, it searches a speed neighborhood (±15%), then a
spin neighborhood (±20%). Groundstroke preference is at most 22°; this is a soft
comfort preference, not a universal tennis limit. Net clearance and target error
remain explicit checks. Exact mode keeps both inputs and can expose an
unreachable target. Wind remains an external disturbance to the selected shot.

Movement and stroke are separate clocks: requested contact-to-contact interval,
uniform stroke source time, and distance-based gait time. The interval cannot
override the complete stroke and bounded travel budget. Preferred movement pace
can rise toward the allowed maximum when the requested gap is tight. Otherwise
the player can move promptly and wait. Acceleration and braking also drive body
lean and gait blending, rather than only easing the root position.

See [ADR-0017](../decisions/0017-independent-practice-clocks-and-natural-targets.md).
