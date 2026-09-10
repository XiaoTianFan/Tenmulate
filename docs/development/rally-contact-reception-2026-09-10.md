# Rally contact reception — 2026-09-10

## Diagnosis and implementation

The reported physical phase reversal was not reproduced in the current default
and live deep-zone fixtures: `contactsForTiming` already filters the selected
bounce phase. The movement defect was reproducible. Recovery planning had no
player return-contact cue, so it could approach before that cue at a slow preferred
pace. Compilation also lacked a final guard against overwriting an infeasible
movement budget with an earlier physical return clock.

Quick Rally and player-first drills now pass the incoming physical contact record
through feasibility, rate solving and animation. The shared planner reserves a
receiving split, limits neutral recovery to the available time and accelerates the
approach to reach the prepared stroke entry. A continuing approach remains possible
for exchanges that cannot react after the cue even at the physical ceiling. The
selected ball phase and contact point never change to accommodate that route.
See [ADR-0044](../decisions/0044-contact-anchored-opponent-reception.md).

## Automated verification

- Full suite: **551 tests / 51 files passed**.
- Production build, TypeScript and active motion/cache guard passed. The active
  25-clip bundle remains `tennis-local-v1.64f3bc37161d.glb`.
- New regressions cover default and live deep-zone geometry, both hands and
  requested intervals of 2.5, 5 and 8 seconds. They check the derivative of actual
  rendered ball positions, shared movement feasibility, receiving-cue windows,
  bounded root speed and the existing actual-interval indicator.
- Actual GLTF/OpponentRig checks cover post-IK contact anchors, continuous practice
  batch joins and backward seeks. Existing bounce-phase matrices and shipped and
  mirrored drill checks also pass.

## Rendered gameplay review

A temporary development review surface used the real `TennisScene`, active GLTF,
compiled Quick Rally and mutable session clock. Eighteen states covered both hands,
all three contact phases and bounce/apex/contact checkpoints. Side-view screenshots
were inspected at bounce apex and contact, including the left-hand return.

Representative first-return measurements in seconds on the session clock:

| Hand / selected phase | Bounce | Bounce apex | Contact | Contact height |
| --- | ---: | ---: | ---: | ---: |
| Right / rise | 5.875 | 6.267 | 6.133 | 0.770 m |
| Right / apex | 5.875 | 6.267 | 6.267 | 0.864 m |
| Right / early descent | 5.875 | 6.267 | 6.383 | 0.791 m |
| Left / early descent | 5.871 | 6.267 | 6.383 | 0.784 m |

The apex is calculated from the incoming flight before contact truncation; for a
rising intercept that later apex is hypothetical because the ball has already
been returned. Actual rendered ball-to-racket contact error was below 0.000002 m
in all six hand/phase contacts (regression tolerance: 0.002 m).

For the default right-hand descending fixture, the player releases at 4.600 s.
The receiving split spans 4.480–4.700 s and the approach spans 4.700–6.156 s,
followed by contact at 6.383 s. Resolved stroke/movement rates are about 117%/191%.
Before this change, the same first approach began at 4.372 s, before the release,
using about 103%/108%. The new schedule uses the available receiving window to
move promptly while preserving the descending intercept.

The rebuilt production preview was reloaded with the existing live setup at
1280×720. Both Early descent selections and 100% preferred rates remained intact;
the interface reported resolved 135% stroke / 277% movement and a physical contact
interval of 3.37 s. No user settings were changed during review.

## Limits

A requested five-second interval is not guaranteed when the configured flights
produce a shorter physical exchange. Existing UI reporting remains accurate;
this change does not add ball holds, flight retiming or artificial high arcs.
No new performance benchmark, asset change or public deployment is claimed.
Local automated and rendered review is complete; owner acceptance remains separate.
