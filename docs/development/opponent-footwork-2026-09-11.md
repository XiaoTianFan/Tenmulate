# Automatic opponent strokes and natural footwork

Date: 2026-09-11. Implementation commit `7beee6f` under [ADR-0047](../decisions/0047-automatic-opponent-stroke-and-footwork.md).

## Implementation

`opponentStroke.ts` supplies one contact-based forehand/backhand selector to
`compileSession.ts` and `compilePlayerDrill.ts`, including feasibility checks and
editor response previews. Explicit choices still constrain the result. Automatic
can repeat the convenient side; repetition parity is no longer a selection input.
The compiler's physical incoming contact, movement scheduler and rendered stroke
use the same selected side and racket anchor.

`opponentMovement.ts` removes unnecessary neutral excursions near the ready area,
holds spare time before a concise approach, and adds moderate lateral crossovers.
`locomotion.ts` enables forward/backward/diagonal nudges, finite small placements,
and distance/urgency gates that avoid turning a short unhurried correction into a
jog. Fast travel still recruits the running clip with bounded source cadence.

Quick Practice now displays Automatic / Forehand / Backhand. The editor offers
Automatic for opponent responses while retaining the authored player's fixed side.
Legacy Alternate sides preferences migrate to Automatic. Only unchanged seeded
records were updated: 21 project shot responses and 52 response fields across 16
project drills. Custom fixed settings and independent saved timeline copies retain
their authored meaning. No project save API or storage scope changed.

## Verification

- **574 tests / 54 files pass.** Includes deterministic body-relative side choice
  for both hands, fixed-side constraints, shared rally compilation, player/opponent
  validation, four-direction and diagonal nudges, running, neutral recovery,
  prepared entries, contact phases, shipped drill connectivity and source-rate
  continuity. Prepared-entry tests use an actual connected rally rather than the
  removed artificial sidestep.
- **Production build and active motion/cache guard pass.** Same 25-clip
  `tennis-local-v1.64f3bc37161d.glb`; no motion/model asset change. The pre-existing
  large-chunk build advisory remains.
- Actual Three.js/GLTF review in an isolated browser used the app's compiler,
  session flight clock, timeline sampler and rendered `OpponentRig` after blending
  and foot correction. The production app is checked separately below.

| Rendered case | Observation |
| --- | --- |
| Six connected right-handed Quick Rally shots | FH, BH, BH, BH, FH, BH; no planning issues |
| Same setup, opponent left-handed | FH, FH, BH, BH, BH, FH; no planning issues |
| Nearby right-handed reception | Roughly 0.75 m approach in 0.938 s; midpoint 94.3% backward adjustment, 4.0% walk, 1.7% run; chest stays toward play |
| Receiving window | Ready after the split, then approach at 5.4395–6.3771 s; descending ball contact at 6.6333 s |
| Corner switch drill | 6.628 m leg in 2.431 s; midpoint 3.895 m/s, 100% running layer, visible rear heel recovery |
| Both-hand drill contact | Forehand/backhand resolve from the receiving side; all four reviewed descending contacts have post-blend racket/ball error below 0.001 mm |
| Moderate lateral recovery | 2 m at preferred 100% begins with `cross-front-right`, facing play; visible crossing placement without the former deep squat |

The render inspection caught a 0.75 m backward leg that still selected a jog;
distance/urgency gates were corrected before the final test/build run. Quick Rally
contact error was also below 0.001 mm for both hands. These are measured alignment
checks, not a claim of physical model accuracy to that precision.

## Production preview

The rebuilt app at `http://127.0.0.1:5173/` shows Automatic after the service-worker
update/reload. The editor exposes Automatic for the opponent, with only Forehand
and Backhand in the player's authored identity. Existing draft content survives
navigation; no QA drill or shot was saved into the project catalogs.

The old preview process retained its pre-upgrade validator and initially rejected
the new opponent `auto` value. Restarting the same project preview loaded the
updated shared validation. Both project catalog endpoints then returned HTTP 200,
and the editor's Save to project action became available. No validation rule was
bypassed. Browser error/warning logs were empty. The updated local preview remains
running; the separate temporary motion-review server is removed.

Local verification is distinct from owner visual acceptance and public deployment.
Automatic sliding and replacement source clips were not added. The current authored
running, adjustment and crossover motions retain their production limitations.
