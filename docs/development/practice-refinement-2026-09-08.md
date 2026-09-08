# Practice refinement — 2026-09-08

Contract: [ADR-0017](../decisions/0017-independent-practice-clocks-and-natural-targets.md).
Rationale and primary sources: [movement and trajectory research](../research/practice-motion-and-trajectory.md).

## Implementation evidence

- Trajectory stage `2f3e94b`: low-branch continuity and bounded natural target
  adjustment; 26 trajectory/refinement tests passed.
- Planner stage: the selected position is the recovery root. Alternating or
  chosen sides move 0.7–0.9 m laterally; contact follows the racket anchor while
  the landing target remains fixed. Serve roots stay at the service start.
- Contact interval and stroke clock are independent. A 70% stroke can use short
  or long gaps; a 150% stroke can wait for a 12-second interval. Travel raises its
  preferred pace only under interval pressure, within 4.8 m/s and 6.5 m/s².
- The locomotion distance curve integrates push-off, cruise and braking with
  zero endpoint velocity/acceleration. Speed blends gait layers; signed
  acceleration adds movement-only pelvis lean before fixed-length foot IK.
- Focused planner, trajectory, both-hand rendered-rig and motion checks:
  111 tests passed. Full application integration and browser evidence follow.

## Verification still in progress

Practice controls and persistence, first-bounce axis interaction, actual loaded
gameplay at multiple rhythms, full regression/build and screenshot comparison.
No owner acceptance or public deployment is implied.
