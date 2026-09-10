# ADR-0046: Calibrated court bounce shared by both players

- Status: Accepted for local implementation
- Date: 2026-09-11
- Supersedes: The retained bounce-response coefficients in ADR-0040. Its airborne
  physics, Natural/Exact arc policy and contact-aware fitting remain in force.

The default factor 1 bounce must pass a reference drop and represent an oblique
tennis collision. `courtBounce.ts` owns the surface profiles, impact-speed/angle
dependent normal restitution and friction/spin response. Both flight directions
use this function through the existing integrator. No renderer-only height boost
or separate player-return physics is introduced.

Calibrate the hard reference against the ITF Type 2 drop with air drag included.
Use a bounded empirical oblique correction and a deformable-ball tangential
response, including normal-impulse offset and modest elastic grip. Preserve the
explicit first-impact bounce-factor override. Surface coefficients represent
generic dry courts rather than a named venue or exact ball specimen.

Keep contact phases, motion clocks and landing zones authoritative when recompiling
the higher rebound. Quick Rally and drills share the existing five-metre run-back
contact space; the old tighter Quick Rally cutoff must not reject a legal descent.
Do not expand racket reach or switch to an earlier bounce phase to connect a rally.

Regression and rendered evidence, calibration values and limitations are recorded
in [the research receipt](../development/ball-bounce-research-2026-09-11.md).
The compiled solver identifier is `ball-v10-court-bounce`.
