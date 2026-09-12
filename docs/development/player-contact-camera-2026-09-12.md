# Player contact camera investigation — 2026-09-12

## Reproduction

The live project copy of **Crosscourt Rhythm** has four player events. Shot 3 is
a right-handed forehand with lateral -2.75118 m, behind-baseline 3.52009 m,
yaw 13.52594 degrees, pitch -3.00371 degrees and horizontal FOV 70 degrees.
Default seed 18427, hard-court physics and four repetitions reproduce the issue.
Its camera transitions have no explicit overrides.

The prior camera correctly reached every authored endpoint. At shot 3
(11.98333 s), the continuous incoming flight supplied contact
(-2.49964, 1.18248, -15.92234) m. The nominal preview used
(-3.20118, 1.05, -14.75509) m. The 1.4 m reach disk admitted that discrepancy,
including a contact behind and across the player's body. This was a mismatch
between physical interception and camera placement, not inverted camera yaw.

## Change

[ADR-0048](../decisions/0048-player-contact-footwork-camera.md) resolves a stance
from the physical contact, preserving authored direction and eye height. The
existing camera planner uses the resolved stance when checking and scheduling
movement. Shot 3 now settles at lateral -2.04964 m and behind-baseline 4.68734 m:
an adjustment of .70154 m in x and 1.16725 m farther back (1.362 m total).
Its forehand contact is .45 m on the racket side and .65 m ahead of the eyes.

For this four-shot reproduction, contact positions and all player timestamps
remain identical before and after. At 50 ms into shot 3, the ball's projected
horizontal position changes from 27.5% to 73.4% of screen width. At 25 ms the
corrected ball is visible in the lower-right, mirrored to lower-left for the
left-handed drill. In other configurations, the planner can select a different
physical contact candidate to satisfy the corrected travel route.

The editor labels its independent preview **Isolated shot · Estimated contact**.
**Preview actual shot** runs the selected contact's reception/release on the
compiled sequence camera and returns to editing. Incomplete or infeasible
sequence solves cannot enable it. Authored project drills and saved shots are
not rewritten by compilation.

## Verification

- Full existing suite: **580 tests / 54 files passed**. Two additional fixture
  regressions pass for right/left hands, immutable authoring, continuous ball
  contacts, bounded adjustment, settled camera and projected stroke side.
- Existing 240 Hz continuity, speed/acceleration, custom-waypoint, new-point,
  timing-phase, catalog and handedness tests pass with resolved contact endpoints.
- `npm run build` passes, including the active 25-clip model/precache guard.
- Isolated Edge/Playwright at `http://127.0.0.1:4187`, desktop 1600×940 and
  mobile 390×844: nonblank app, correct identity, no framework overlay, no page
  errors or console errors, no horizontal mobile overflow. Browser plugin not
  available; used the existing external Playwright installation.
- UI: Drills → Edit drill → shot 3 → Preview actual shot → Actual sequence →
  automatic return to estimated-contact editing. Actual Three.js frames in both
  hands use the compiled session, physical ball and animated opponent; no WebGL
  errors. Inspected the gameplay frames and desktop/mobile editor screenshots.

Evidence scripts, before/after numeric probes, rendered frames and UI screenshots:
`C:/Users/20378/.codex/visualizations/2026/09/12/01a09414-f625-7dd2-ba82-d570264839e1/`.
The earlier-policy comparison uses the same physical session with its original
authored camera held through the stroke. Owner source edits in project catalogs
and the existing `tmp/` directory remain outside these commits.

Local implementation and browser verification only. Owner comfort acceptance,
physical mobile/browser coverage and public deployment remain separate gates.
