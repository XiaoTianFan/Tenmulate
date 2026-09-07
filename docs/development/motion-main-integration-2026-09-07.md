# Motion/model main integration — 2026-09-07

Scope: reconcile the motion laboratory and gameplay documentation, include every
latest motion/model feature in local main, and verify the actual practice consumer.
This record is updated after the merge and live review; it does not declare a public deployment.

## Branch and asset authority

The starting main was `abc4300`; the motion feature tip was `643610e`.
`git rev-list --left-right --count main...codex/reference-led-anatomical-motion`
returned `0 17`. No other local feature tip was outside the motion branch's ancestry.
Each repository has one worktree and neither has a configured remote.

Lab source/authoring is `f3cee2f` with review/evidence `f3609ef`, already on its main.
The gameplay bundle is `tennis-local-v1.f313ece32de3.glb`, SHA-256
`f313ece32de3db2f70f3e45ec07a947774c7552a3533fb85bf5c39d74c356e45`,
2,993,676 bytes, 24 clips, bound to the 1.88 m articulated mannequin.

## Fact reconciliation

| Surface | Status | Authority and action |
| --- | --- | --- |
| Model, library and calibration | verified-current | Consumer check matches active JSON, GLB, carrier and published manifest. No motion/rig values changed in this closeout. |
| Gameplay selection and mechanisms | verified-current | Session compiler → motion/recovery sampler → real rig → TennisScene. Separate normal/compact clocks, stroke mapping, mirrored contact and recovery are present. |
| Offline delivery | changed-and-verified | Only the active opponent GLB is precached. Retained old assets no longer inflate the required offline download. |
| Lab and consumer docs | changed-and-verified | Current runbooks/index replace stale “latest” claims; old model record and revision results are marked historical. ADR-0014 supersedes carrier selection without rewriting accepted decisions. |
| Project rules | changed-and-verified | Minimal AGENTS in both runnable projects link actual commands and authorities; user/global instructions remain unchanged. |
| Global generated memory | out-of-scope | Read-only; no memory item updated. |
| Local main merge | pending | Fast-forward integration and post-merge ancestry check follow the focused commits. |
| Actual-app browser review | pending | Verify both service choices and ordinary stroke/recovery in the main checkout. |
| Public deployment | not-applicable | No remote or public release requested/configured. |
| Final owner technique/device acceptance | pending | Mechanical checks and local browser review do not close those release gates. |

## Verification

Frontend: 237 tests in 22 files pass. Production build and the independent consumer
asset/cache check pass. Lab preservation, actual-rig gameplay and crossover checks
pass. Full logs stay in frontend `artifacts/motion-integration-*.log` and lab
`work/main-integration-*.log`; final merged/live results follow below.

The compact preservation report corrects earlier prose: all 23 old layouts,
timestamps and metadata are unchanged; forehand has a maximum decoded difference
of 1.7881393e-7 within the existing 2e-7 tolerance, while 22 other clips are exact.

## Retained evidence and limits

No branches, worktrees, source videos, baselines or old GLBs were deleted.
The feature branch and retained opponent bundles are future cleanup candidates
after review; the original carrier remains a required skeleton source. Large lab
work/output and frontend character sources remain ignored local evidence.

Half-volley, overhead and one-handed-backhand labels still use documented proxies.
Jump, slides and back crossovers are explicit runtime review primitives; automatic
hard-court recovery uses run/walk/adjustment and wide-recovery front crossovers.
The existing large frontend chunk warning remains. Neither proxy expansion nor
target-device/public release qualification is part of this merge closeout.
