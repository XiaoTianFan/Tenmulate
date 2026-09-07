# Motion/model main integration — 2026-09-07

Scope: reconcile the motion laboratory and gameplay documentation, include every
latest motion/model feature in local main, and verify the actual practice consumer.
Local main integration and production-browser review are complete. This record does
not declare a public deployment or owner technique acceptance.

## Branch and asset authority

The starting main was `abc4300`; the motion feature tip was `643610e`.
`git rev-list --left-right --count main...codex/reference-led-anatomical-motion`
returned `0 17`. No other local feature tip was outside the motion branch's ancestry.
Each repository has one worktree and neither has a configured remote.

Main was fast-forwarded to `a9ba202`, including all 17 motion/model commits plus
the delivery guard `1634a58` and documentation reconciliation `a9ba202`.
The post-merge main/feature difference is `0 0`; `git branch --no-merged main`
returns no local feature tips. The final documentation receipt is committed on main.

Lab source/authoring is `f3cee2f` with review/evidence `f3609ef`, already on its main;
documentation reconciliation is committed there as `d8d7c2d`.
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
| Local main merge | changed-and-verified | Fast-forwarded to `a9ba202`; every local feature tip is included. Both repositories were clean after their focused integration commits. |
| Actual-app browser review | verified-current | The main checkout's production build was reviewed through ordinary practice controls: both serves, both-handed contact, groundstrokes, volleys and full-rally recovery. |
| Public deployment | not-applicable | No remote or public release requested/configured. |
| Final owner technique/device acceptance | pending | Mechanical checks and local browser review do not close those release gates. |

## Verification

Frontend: **237 tests in 22 files pass**. Production build and the independent
consumer asset/cache check pass. The tested tree was fast-forwarded unchanged;
only this final receipt/status update follows it.

The new `npm run check:motion` verifies the active binary, published clip metadata,
carrier provenance, skeleton/calibration and separate serve clocks. The build's
distribution check also verifies the emitted hash and that exactly the active
opponent GLB appears in the service worker. Excluding seven inactive opponent GLBs
reduces precache from 42 entries / 19,226.56 KiB to 35 entries / 4,361.24 KiB. The
retained files themselves are not deleted. The current documentation link audit
passed 133 local links with no missing targets; `git diff --check` passed.

Fresh lab checks pass: compact preservation; actual-rig gameplay at 240 Hz for
both hands (38 movement cases and 12 mixed events per hand); and eight mirrored
crossover cases at 120 Hz. These exercise the gameplay consumer after blending
and IK. Existing full-library export/anatomy/choreography evidence remains bound
to the unchanged active hash; this closeout did not rebake the animations.
Logs stay in frontend `artifacts/motion-integration-*.log` and lab
`work/main-integration-*.log`, with preservation in
`work/compact-closeout-preservation.log`.

### Actual gameplay and local services

The production build runs from the main checkout with:

```powershell
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5173 --strictPort
```

The gameplay app at `http://127.0.0.1:5173/`, MotionLab at
`http://127.0.0.1:4184/`, and gameplay review harness at
`http://127.0.0.1:4185/review/gameplay.html` returned HTTP 200. The active GLB served
by the production preview matches the complete SHA-256 and byte count above.
These are local service observations at closeout, not permanent uptime promises.

Browser verification used the ordinary practice setup and rehearsal screen:

- Right-handed Compact selects `serve-compact` at its 1.3000 s contact;
  left-handed Normal selects `serve` at 1.7833 s. Both retain the selected
  135 km/h ball pace. The visible mannequin and racket mirror with handedness.
- Forehand and backhand contacts select their dedicated clips. A full 12-repetition
  rally completed in 100 seconds, with the final ready root at x = 0.55 m,
  z = 13.30 m after recovery toward baseline center.
- Explicit Volley practice selects `forehand-volley` and `backhand-volley`,
  including their 0.7000 s and 0.5833 s contacts.
- Rendered contact diagnostics round to 0.00000 m for these sampled contacts.
  Pause, previous/next repetition, resume and restart were exercised; restart
  returned playback to set 1. The browser reported no warnings or errors.

Gameplay remains open and paused for review. Live visual inspection confirms the
articulated model and representative motion/transition behavior; it is distinct
from the owner's final technique judgement and target-device qualification.

The compact preservation report corrects earlier prose: all 23 old layouts,
timestamps and metadata are unchanged; forehand has a maximum decoded difference
of 1.7881393e-7 within the existing 2e-7 tolerance, while 22 other clips are exact.

## Retained evidence and limits

This cleanup deleted no branches, worktrees, source videos, baselines or old GLBs.
The feature branch and retained opponent bundles are future cleanup candidates
after review; the original carrier remains a required skeleton source. Large lab
work/output and frontend character sources remain ignored local evidence.

Half-volley, overhead and one-handed-backhand labels still use documented proxies.
Jump, slides and back crossovers are explicit runtime review primitives; automatic
hard-court recovery uses run/walk/adjustment and wide-recovery front crossovers.
The existing large frontend chunk warning remains. Neither proxy expansion nor
target-device/public release qualification is part of this merge closeout.
