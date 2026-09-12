# ADR-0050: Grounded opponent contacts before timing preferences

- **Status:** Accepted for local implementation
- **Date:** 2026-09-12
- **Scope:** Opponent contacts in player drills, isolated previews and Quick Rally
- **Supersedes:** The unconditional opponent phase constraint in ADR-0040 and
  ADR-0044. Player contact phases and immutable physical flight clocks remain.

## Problem

Contact fitting allowed balls above the selected clip's racket anchor. Playback
translated the pelvis upward and tried to restore the original foot anchors with
rigid two-bone IK. Once the legs reached full extension, the feet could no longer
reach the ground, leaving the opponent floating around the hit.

## Decision

The selected clip's scaled contact anchor sets the opponent's conservative maximum
contact height. Lower contacts use existing crouch and foot correction. Automatic
stroke selection uses the lower of the two side ceilings so footwork can choose
the convenient side without forcing a different stroke merely for extra height.

Keep the configured phase when it offers a supported contact. Otherwise search
later descending samples of the same physical flight, within the existing court,
family and bounce limits. An unreachable apex can become a descending contact.
A half-volley must still rise after the bounce; a volley must still be airborne.
If no supported intercept can connect the exchange, retain the existing infeasible
result. Never pause the ball or move its samples to fit the motion.

Carry the selected position and clock together through outgoing flight solving,
reception, stroke-side choice, recovery, interval solving and playback. Movement
and swing rhythm adapt to the new intercept; reported intervals/phases reflect it.
Opening and independent feeds have no incoming ball to wait for, so their launch
height is capped before solving their trajectories. Authored preset files remain
unchanged. Player camera-relative volley contacts retain ADR-0049's behavior.

As a defensive guard, the renderer limits upward pelvis correction on non-serve
clips to the rigid legs' actual reach to their original foot anchors. Unsupported
legacy poses cannot pull the feet upward. Planned contacts satisfy the stronger
height constraint and do not depend on this guard to achieve racket contact.
Authored service jumps, source clip clocks, bone lengths and racket grips remain.

## Verification

619 tests in 58 files pass, including delayed contacts, supported apex retention,
half-volley/volley phase constraints, automatic stroke choice, all shipped drills,
rigid-foot support for deliberately invalid high poses, both hands and seeks.
The slice motion fixtures now use a supported 0.98 m contact; the former 1.10 m
fixture depended on the floating correction being removed. Production build,
active motion integration and precache checks pass.

Playwright/Edge ran the gameplay renderer for all 16 built-in drills in both hands
and all 16 current saved drills: 48 sessions, 780 contact-window frames, no planning
issues or browser errors. Maximum foot-anchor deviation was below 0.000001 m;
contact error rounded to 0.00000 m in renderer diagnostics. A close view of the
saved Crosscourt Rhythm contact was inspected. An additional Quick Rally apex
case waited 0.283 s after a 1.51 m apex and contacted at 1.09–1.10 m, with zero
reported racket error. These are deterministic simulation examples, not measured
human reaction times. Evidence:
`C:/Users/20378/.codex/visualizations/2026/09/12/01a09414-f625-7dd2-ba82-d570264839e1/grounded-opponent/`.

Planner versions: `gameplay-opponent-footwork-v14` and
`gameplay-player-drills-v20`. No motion asset, saved catalog or schema migration.
Local implementation and verification; owner acceptance and deployment are separate.
