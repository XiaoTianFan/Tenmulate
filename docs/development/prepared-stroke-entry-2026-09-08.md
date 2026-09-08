# Prepared stroke entry — verification receipt

Local implementation and browser review, 2026-09-08. Applies
[ADR-0021](../decisions/0021-prepared-stroke-entry-after-travel.md).
MotionLab authoring, publication gates and evidence are committed as `81c14b1` in
the independent sibling repository.

## Defect and resulting behavior

The travel sampler faded back to `ready` on arrival, waiting also returned `ready`,
and the next stroke always started at clip time zero. Together those paths made
the sideways opponent face the net briefly and repeat its unit turn.

The lab now publishes completed unit-turn boundaries for the six drive/slice/volley
clips and explicit push-off/glide/braking segments for the three slide primitives.
Gameplay blends toward the prepared stroke while braking, fades locomotion foot
constraints with it, and holds that pose until the swing starts. Stroke entry uses
the authored post-turn time and continuous contact-height correction. The shared
planner budgets the approach and remaining swing lead before fixing contact times;
its version is `gameplay-rhythm-v4`.

Initial practice approaches, repeated home recovery, drill direct routes and full
recovery use the same path. Entry selection uses the requested contact time, so
same-position drill repetitions correctly prepare after a full recovery route.
Incoming legs that reduce to a turn in place still
complete the reserved preparation. Stationary starts without an incoming leg and
serve/overhead proxies keep full preparation. Automatic hard-court movement remains
footstep-based; explicit slide braking supports the same prepared arrival contract.

The complete rebuilt 25-clip asset is byte-identical to its baseline:
`tennis-local-v1.64f3bc37161d.glb`, 3,198,012 bytes, SHA-256
`64f3bc37161dfc2fcf536e80a6e39465792bdc6a822dd26493d04d2ab2bd3eaf`.
The lab owns the new phase metadata; authored poses, source cadence, grips, bone
lengths and contact markers are preserved. See the
[lab contract](../../../Tenmulate_motion_analysis/docs/prepared-stroke-entry.md)
and [compact evidence](../../../Tenmulate_motion_analysis/docs/evidence/prepared-stroke-entry.json).

## Verification

| Check | Result |
| --- | --- |
| Full lab build | Source previews, solver, full Blender bake, export/choreography/anatomy, 20 JavaScript and four Python rhythm tests pass |
| Entry publication gate | Six decoded prepared poses pass; old net-facing ready entries are rejected; segmentation/checker hashes must match |
| Frontend suite | **300 tests / 28 files pass**, including 12 prepared-entry regressions |
| Both-hand runtime | 13 mixed events per hand, 38 movement sweeps and six slide-to-stroke approaches pass after actual blending/IK; zero anatomical failures; separate crossover checks pass |
| Contact and continuity | Entry boundary checks cover pelvis/hands/feet; exact contact remains within 2 mm, seeks deterministic; existing full-runtime 120 Hz equivalent continuity budget remains unchanged |
| Rhythm | All six stroke entries checked in both hands at 50%, 100% and 150% |
| Build/integration | Production/PWA build and active asset/metadata/cache guard pass; only the selected GLB is precached |
| Browser phases | Six lab entry views and prepared playback loops; 24 actual-renderer sequences across six clips × both hands × practice/drills; no page errors |
| Ordinary playback | Four timed practice/drill runs across both hands; arrival continues into the stroke without a ready reset |
| User preview | Existing `127.0.0.1:5173` tab refreshed; saved practice/camera settings preserved and court running |

The old behavior is retained as a negative fixture: entry at clip time zero has a
near-zero shoulder coil, whereas the prepared entry is above the explicit 0.65 rad
product threshold. That threshold distinguishes the reported regression; it is
not an anatomical limit. The active source clip's complete preparation remains
available in MotionLab rather than being removed from the asset.

## Review artifacts and limits

Local evidence root:
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/prepared-entry/`.
`lab-*.png` show the named phase and reference labels. `sequence-{mode}-{hand}-{clip}.png`
show braking, arrival, strike entry and contact. `playback-{mode}-{hand}.png` retain
frames from ordinary playback. `report.json` records sample clocks/layers;
`playback.json` records the running clock. These are local review artifacts, not
publicly hosted downloads or a device-performance benchmark.

Full logs/baseline binaries stay in the lab's ignored `work/prepared-entry-*` and
frontend `tmp/prepared-entry-*`. The changes are local implementation with agent
visual verification. Owner technique acceptance and public deployment remain separate.
