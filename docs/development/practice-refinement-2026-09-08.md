# Practice refinement — 2026-09-08

Contract: [ADR-0017](../decisions/0017-independent-practice-clocks-and-natural-targets.md).
Rationale and primary sources: [movement and trajectory research](../research/practice-motion-and-trajectory.md).

Focused local stages: `2f3e94b` (trajectory), `93fa2bf` (recovery and clocks),
`f9fb4b8` (validated turns and overhead integration). The sibling motion lab is
committed at `e4b1de5`; its working tree is clean. The final frontend stage adds
the practice/drill/editor controls, target handles, persistence and this receipt.

## Delivered behavior

- Trajectory stage `2f3e94b`: low-branch continuity and bounded natural target
  adjustment; 26 trajectory/refinement tests passed.
- Planner stage `93fa2bf`: the selected position is the recovery root. Alternating or
  chosen sides move 0.7–0.9 m laterally; contact follows the racket anchor while
  the landing target remains fixed. Serve roots stay at the service start.
- Contact interval and stroke clock are independent. A 70% stroke can use short
  or long gaps; a 150% stroke can wait for a 12-second interval. Travel raises its
  preferred pace only under interval pressure, within 4.8 m/s and 6.5 m/s².
- The locomotion distance curve integrates push-off, cruise and braking with
  zero endpoint velocity/acceleration. Speed blends gait layers; signed
  acceleration adds walk/run torso lean while retaining the authored pelvis and
  fixed-length foot IK. Slides/crossovers keep their authored poses. A near-zero
  recovery distance still reserves time to turn in place.
- Shot family and side are separate controls. Groundstroke/volley use their
  existing side-specific clips; backhand overhead uses the new generic authored
  2.8-second clip, with contact at 1.2 seconds and approximately 2.26 m. Forehand
  overhead retains its normal-serve proxy without a self-toss.
- Practice, drill launch, editor preview, saved drills and preferences retain
  separate stroke rhythm (50–150%), interval (1–30 s), and movement pace (50–150%).
  A linked rally cannot silently shorten a long requested interval: if it cannot
  span the gap physically, the next shot starts as a new feed.
- First-bounce handles use separate court-space axes, left-button pointer capture,
  click steps and keyboard arrows. Direction keeps depth fixed; depth keeps lateral
  target position fixed. Camera look is unaffected. Return's T/Body/Wide pattern
  switches to a custom legal service-box target when edited, persists through
  reload and can be restored using Serve placement.
- Natural target resolution follows the ascending-range low-angle branch for
  ordinary shots, with explicit ±15% speed/±20% spin adjustments. Exact mode keeps
  speed/spin fixed. The UI displays actual resolved values and unreachable targets.
  Wind remains an external disturbance; lob retains its deliberate high arc.

## Validation and rejected candidates

The final frontend suite passes **255 tests in 24 files**, including actual
first-bounce accuracy across family/side/hand combinations, independent clocks,
trajectory heading continuity, infeasible requests, contact after real IK at
0.5/0.85/1/1.2/1.5 rates, storage and deterministic seeks. The reported 70 km/h,
1,103 rpm case stays below a 4 m apex across a ±10° heading sweep in 0.5° steps;
neighboring launch-angle changes stay below 3° and landing error below 0.18 m.

`npm run check:motion` and the production/PWA build pass. The active bundle is
`tennis-local-v1.64f3bc37161d.glb`, 3,198,012 bytes, 25 clips. Only that opponent
GLB is precached. The cache size allowance increased from 3 to 4 MiB to include
the new clip; retained old bundles are still excluded.

The lab's full solve/bake passed export (zero errors/warnings), choreography,
anatomy and contract checks. Its first consumer check rejected pelvis lean during
slides/foot IK. Torso-only walk/run lean fixed the anatomy failures. The next
check caught a zero-distance recovery turn: reserving turn time reduced maximum
equivalent 120 Hz wrist step from 0.1551 m to 0.0776 m. The unchanged 0.15 m
continuity limits, grip/length/contact gates and anatomical envelopes now pass
for 13 mixed events per hand and 38 movement sweeps. Crossovers pass separately.
See the lab [overhead record](../../../Tenmulate_motion_analysis/docs/practice-overhead.md)
and [hash-bound evidence](../../../Tenmulate_motion_analysis/docs/evidence/practice-overhead.json).

All 24 old clip layouts, timestamps and metadata are preserved. Twenty-three
have identical decoded values; forehand has at most 2.3841858e-7 export float
drift (two float32 ULPs), explicitly recorded rather than called bit-identical.

## Browser and visual evidence

Chrome through the cached Playwright runtime inspected production preview at
`http://127.0.0.1:5173/` (1440×1000, 767×898 and 390×844). Assertions pass for
direction/depth isolation, unchanged camera, click/keyboard control, preference
reload, both-hand backhand overhead selection, actual practice playback,
70%/14-second drill launch, 145%/13-second/135% editor save and Return custom/pattern
round trip. No application errors or horizontal overflow were observed. A known
GPU shader precision warning remains in Chrome's console; it did not prevent rendering.

MotionLab review covered front/side overhead preparation/contact/follow-through.
The actual gameplay harness at port 4185 covered both-hand walk/run push, cruise
and brake frames, and normal-speed playback, with 63 joints passing after IK.
Browser screenshots were inspected for the court, loaded player, controls,
visible axis contrast and responsive layout. Headless UI checks used test browser
storage, not the owner's saved drills/preferences.

Local evidence directory:
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/`.
Receipts: `practice-refinement-production.json`, `practice-final-flows.json`,
`return-target-qa.json`, `movement-refinement-review.json`, `mobile-ready-qa.json`.
Representative images: `return-hover-handles.png`, `production-practice-overhead.png`,
`production-editor-independent-clocks.png`, `production-mobile-390.png`,
`motion-run-right-push.png` and `motion-run-right-brake.png`.

Local implementation and browser/mechanical verification are complete. Owner
technique acceptance, device qualification and public deployment remain separate.
