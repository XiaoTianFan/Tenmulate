# ADR-0033: Complete short running steps after gameplay correction

- Status: Accepted for local implementation
- Date: 2026-09-08
- Extends: ADR-0032 (gait selection and rate ownership)
- Supersedes: its short-jog foot-path and urgency calibration

## User correction and diagnosis

The owner still saw jerky walking at 2.5 s / 150% stroke / 150% movement, resolved
to approximately 218% / 285%. The previous build did select `run-forward`, but
that name did not establish the requested visible running action. Actual post-IK
ankle lifts were only 5–9 cm. A repeating distance cycle was cut short at the end
of a short route, while 0.22 s ready blends muted much of its motion.

## Decision

1. Strong acceleration can select full running form even at the low peak speeds
   of short trips. The urgency blend reaches full weight at 8 m/s² and 1.2 m/s.
   This is a calibration for the authored player, not a physiological threshold.
2. For urgent 0.65–1.1 m routes, replace the truncated cycle with a complete
   two-foot placement action. Each foot starts at its actual ready anchor,
   swings once and remains at its final anchor. First and second swings cover
   0–55% and 45–100% of distance progress, using quintic interpolation with zero
   endpoint velocity/acceleration. Full running heel lift is 0.19 m.
3. Bring the trailing anatomical foot through first to avoid an overextended
   leading-foot lunge. Mirror this selection with handedness. Shift the running
   source phase by half a cycle when the left foot swings first; the source clip
   begins with its right foot in swing. Root distance still owns all clocks.
4. Complete one source cycle for the full two-step action. Preserve the 1.8×
   native running-rate ceiling; blend back to cyclic locomotion where a full cycle
   cannot fit that budget. The action fades in over 0.4–0.65 m and out over
   1.1–1.8 m, with smooth speed/acceleration recruitment. Ready blending falls to
   0.1 s for the full short run. Foot endpoints remain exact throughout the blend.
5. Preserve primary shot interval, physical root speed/acceleration bounds,
   preparation, contacts, fixed bone lengths, rigid grips and authored review
   overrides. No GLB or manifest changes. Planner identity becomes
   `gameplay-rhythm-v8` for the new deterministic motion output.

## Evidence and limits

The [verification receipt](../development/short-running-steps-2026-09-08.md) records
the rejected baseline, actual rig measurements, rendered comparisons and local
build. The new test rejects the prior low heel lift instead of accepting a clip
label as proof. Both versions already produced two detected lifts on the isolated
route; the correction is a complete, clearly lifted and planted action, not a
claim that the earlier numeric step count was greater than two.

These are runtime-authored tennis steps, not newly captured running footage.
Agent inspection and mechanical checks remain separate from owner acceptance.
