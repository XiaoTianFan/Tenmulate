# Local opponent motion pipeline

- **Updated:** 2026-09-06, revision 10 service stance and clearance
- **State:** Twenty-three-clip reference-led library integrated and mechanically verified; visual style remains owner-reviewable
- **Authority:** [ADR-0012](../decisions/0012-local-opponent-motion-pipeline.md)
- **Laboratory:** `F:/Codes/Tenmulate_motion_analysis`, independent Git repository
- **Revision-6 lab commit:** `0399730`. Evidence and the six-image ledger are recorded in the lab's `docs/motion-revision-6.md` and `docs/evidence/revision-6.json`.
- **Volley lab commits:** source/contract `12c8863`, implementation and verification `c0eda97`. See the lab's `docs/volley-motion.md` and `docs/evidence/volleys.json`.
- **Revision-7 lab commits:** annotation contract `bac6d64`, implementation/evidence `e5a855c`. See `docs/motion-revision-7.md` and `docs/evidence/revision-7.json` in the lab.

- **Revision-8 lab commits:** contract `6c89efa`, implementation/evidence `711f983`. See `docs/motion-revision-8.md` and `docs/evidence/revision-8.json` in the lab.
- **Revision-10 lab commits:** contract `7ae4bb2`, implementation/evidence `7065a3a`. See `docs/motion-revision-10.md` and `docs/evidence/revision-10.json` in the lab.

## Production method

Revision 10 corrects the service stance in the player's facing frame: left foot ahead, both toes parallel toward the sideline. The cocking forearm moves outward while retaining the elbow and racket normal. The airborne recovery thigh rotates slightly inward, and gameplay height correction preserves its knee plane. Trophy/drive/drop move 50 ms earlier and acceleration 25 ms earlier, allowing a smooth release into the unchanged contact instant. Toss, finish and total duration remain unchanged. All 22 other clips are exactly preserved after decoding.

The owner's revision-8 review uses the rear UCLA forehand take for rhythm and height, deepens the turn, and carries the arm and shaft toward the back fence. Follow-up review fixes the hitting zone: the racket drops below impact and rises into contact while the elbow remains bent about 48 degrees. Backhand hips stay sideways longer than the shoulders. Serve gains a clear forward carry, a left lead-foot stance, stronger tossing-shoulder elevation and rear-foot gathering during drive/drop. Forehand volley holds a sideways chest through its punch and extension. Production remains visual reference-led authoring, calibrated anatomical fitting and Blender 5.2.1 baking. The other eleven clips retain identical decoded tracks to revision 7.

The existing CC0 Quaternius carrier has 65 bones. Seven DOFs per arm separate shoulder swing/twist, elbow hinge, forearm rotation, wrist flexion and deviation. Fixed segment lengths prevent stretch; anatomical elbow/knee frames replace direction-only aiming. The racket stays rigid in the dominant hand. The left eastern backhand support grip uses bevel **7**, correcting the prior right-handed bevel-3 convention. Forehand preparation couples the support hand to the racket throat before release. Contact-anchored fitting and joint-space recovery avoid wrong forearm branches and reset discontinuities.

## Local evidence and review

The original January and UCLA recordings remain under `C:/Users/20378/Downloads/Video`. They are independent takes, not simultaneous multiview capture. Both MotionLab and MotionSequence always display front/rear reference panels below the 3D scene, aligned by named phases from one motion clock.

| Motion | Default frontal take | Rear |
| --- | --- | --- |
| Forehand | UCLA 13:43.2–13:45.6, impact 13:44.550 | UCLA 02:00–02:02.4, impact 02:00.983 |
| Two-handed backhand | UCLA 13:40.6–13:42.8, impact 13:41.767 | UCLA 09:44.8–09:47.2, impact 09:45.917 |
| Serve | UCLA 28:03.35–28:06.6, impact 28:05.133 | UCLA 33:48.85–33:51.55, **secondary grey-shorts performer**, comparison only |
| Forehand volley | UCLA 22:49.1–22:50.9, impact about 22:49.800 | No verified rear take |
| Backhand volley | UCLA 22:39.5–22:41.3, impact about 22:40.083 | No verified rear take |
| Walking / travel | January relaxed-walk context where assigned | UCLA lateral-recovery context where assigned |
| Slices | No verified complete clean take | No verified complete clean take |

The owner supplied approximate UCLA starting regions; bounded frame inspection selected these complete repetitions nearby. Previous January three-quarter takes remain in the reference registry. Missing views and contextual/secondary footage are explicitly labeled. Slices and generic gait are authored technique, not claimed Djokovic capture. The carrier's proportions and exact personal style still require visual judgment.

## Library and gameplay

The 120 Hz library contains **23 clips**: front/back crossovers in both directions, jump, left/right/forward slides, plus ready, split-step, four `move-*` adjustments, run-forward, walk-forward, forehand, backhand, forehand-slice, backhand-slice, serve, **forehand-volley and backhand-volley**. The denser solve/bake preserves the supporting grip between frames during the fast backhand drop; temporal fitting bounds scale with elapsed time. All strokes return to shared ready. Forehand/backhand/serve durations remain **2.4 / 2.2 / 3.25 s**, with impact at **0.983333 / 1.166667 / 1.783333 s**. Slices contact at 1.05/1.15 s. Serve toss release is at **.883333 s**. Both volleys last **1.8 s**, with contact at **.700 / .583333 s**.

`src/content/opponent-motion.json` identifies the content-hashed active GLB, size, digest and runtime timing contract. `public/assets/opponents/tennis-local-v1.manifest.json` binds visual references, carrier, authoring code, Blender version and rhythm curves. Revision 10 uses `tennis-local-v1.e21e894bfe91.glb`, **2,844,856 bytes**, SHA-256 `e21e894bfe917f1444237c7ff7676f3c2b1a91e201e388036ed83fd993282192`. The existing 3 MiB precache ceiling supports this 2.72 MiB library; the built worker includes only the active tennis library. Earlier libraries remain in Git history.

Volleys use a compact continental preparation, an opposite-foot forward step and a short descending punch. Backhand preparation is guided at the throat, then releases into one-handed contact; both sides recover to the shared two-hand ready carry. Source-phase curves retain the inspected volley cadence. `strokeForShot` selects volley family before spin, so existing slice-labeled volley presets now use the new technique. Explicit side, inferred court position, practice volley selection and handedness work through the existing compiler. Half-volley remains its prior proxy. The revision 8 stroke poses and timing are preserved in revision 9. The backhand volley releases support before its punch so the departing hand cannot drag the racket off the compact path.

`config/motion-rhythm.json` maps source seconds to authored pose coordinates through monotone PCHIP curves. Forehand now uses the rear take, removing the front low-ball repetition's extra waiting beat. Groundstrokes pace measured racket/hand travel from preparation into contact and decelerate toward the finish. One inverse arc map drives the whole body and both arms; supporting backhand grip fitting follows that map. Forehand contact is now **0.983333 s**, and its retimed takeback/lag/extension phases are **0.728 / 0.818 / 1.141 s**. Both reference videos stay aligned by semantic phase; the front is labeled comparison-only. Runtime scales the entire baked curve with event rate and uses the newly published contact metadata. Other source contact times remain unchanged.

The optional forehand `rightArmSweep` transports a fixed elbow triangle along a forward reach arc and solves one shoulder elevation against actual string-bed height. It retains a rigid grip and unchanged wrist posture in the hitting zone. Measured head heights are **1.258 m at takeback, 0.958 m at lag, 1.090 m at contact and 1.631 m in extension**. Exported elbow flexion remains **47.873–48.000 degrees** from lag to contact, with no sampled downward head steps or backward hand reversals. Speed peaks just before impact and decreases across follow-through.

The frontend owns absolute time, court placement, ball physics, camera and audio. Root travel eases to zero at boundaries. Routes of at least 1.65 m run; 0.65–1.65 m routes walk; smaller routes use adjustment steps. Gait phase follows distance covered, with world-space stance anchors and lower foot recovery. The same `opponentMovement.ts` route planner budgets time in compilation and samples it during playback: recover inward (crossover on wide lateral recovery), face the net, split for 0.6 s, then approach the next shot. Behind-baseline recovery uses a 0.55 m forehand-side bias mirrored for handedness; net recovery keeps its depth. Maximum speed is 4.8 m/s and travel acceleration is bounded at 6.5 m/s². Final shots also recover. These are authored timing parameters, not measured athlete limits. Runtime leg IK preserves knee hinge planes and limits ankle rotation. Arm blends reconstruct the elbow hinge because ordinary quaternion blending can introduce sideways bending even between valid source poses. Corrections are restored before repeated or backward seeks.

Ball launches meet the actual string-bed anchor for all seven stroke clips and either hand. Toss release includes the same vertical alignment correction as the animated wrist, then joins exactly one outgoing ball at contact. The compiler preserves complete strokes, reachable travel and configured rest duration, extending an interval when necessary. Rest itself supplies travel time, so adding rest is not always a constant translation of the no-rest schedule. Ball pace remains independent of stroke playback rate.

## Gates and verification

`config/anatomy-limits.json` in the lab defines explicit animation plausibility envelopes. The shared inspector measures **63 articulated joints**, bone-length preservation and **upper-arm plus forearm** torso clearance from actual exported transforms, independent of root yaw, scale or handedness. It reports joint, angle, limit and frame in place. Shoulder posterior excursion uses the frontal plane to avoid a false singularity at horizontal abduction. These are conservative animation checks, not clinical certification.

All clips are sampled at **240 Hz**, including between baked frames. Choreography gates retain signed striking face, grip placement, stable forehand wrist, straight toss elbow, contact, path continuity and clip closure checks. Revision 6 adds lifted preparation elbows, the extended baseline-facing forehand takeback and horizontal closed load, correct toss shoulder tilt/downward racket, physical speed peaks near contact and decreasing follow-through speed, plus the full two-hand carry/sight-clearance interval and gait sway. Revision-5 head clearance, serve leg extension and pronation/unwind gates remain. Revision 7 adds baseline-directed support, backward shaft lag with an advancing hand, deeper backhand coil/front-shoulder tilt, serve cocking elbow-line and overhead contact/tuck checks, sustained backhand-volley turn and bent balance arms. Chest turn is checked separately from the unchanged compact volley arc limit. Clearance uses string-bed/shaft and head-sphere proxies, not a full skinned-mesh collision test. Continuity budgets and anatomical angle limits are unchanged. Reports bind asset, limits and checker hashes; publication rejects missing, stale, failed or partial-library reports.

Historical revision 8 results are recorded in the lab's `docs/motion-revision-8.md` and `docs/evidence/revision-8.json` (commit `711f983`). All 15 clips pass at 240 Hz with zero glTF errors/warnings and zero joint violations. New checks reject revision 7 for the unstable/downward forehand hitting path and the four motions' annotated defects. The actual controller passes 11 mixed events per hand after blending/IK, with maximum contact error **0.0012 mm**. **20 lab JavaScript tests, four Python rhythm tests, 208 frontend tests / 21 files and the production build** pass. Browser review covers the marked poses, both hand settings, 527 half-speed forehand frames and 1,194 continuous gameplay frames through split/forehand/recovery/run/backhand; all captured frame diagnostics pass. The active asset is precached. The existing large-chunk build warning remains. These checks support owner technique review; they do not record owner approval.

Revision 8 adds interval checks for fixed forehand elbow bend, forward hand travel and a string bed below impact which rises through contact and extension. It also checks rear-facing takeback/load, backhand pelvis/chest separation, signed service foot stagger and racket/leg proxy clearance, and the sustained forehand-volley turn. The forehand hand-height floor is 1.06 m to allow the owner-requested dip; the anatomy, rigid-grip, compact-arc and physical continuity budgets remain unchanged.

## Reproduce and collaborate

In the lab, run `scripts/setup.ps1`, then `scripts/build.ps1` through PowerShell. Add `-Publish` to copy a mechanically validated candidate to the frontend and run the gameplay gate. The old `-Extract` option is removed; optional pose diagnostics use `setup.ps1 -PoseDiagnostics` and `extract_pose.py` separately. `-Blender <path>` overrides the portable executable.

Edit `scripts/motion_locomotion.py` for movement poses/stride metadata and the frontend `opponentMovement.ts` for travel and recovery; `scripts/motion_revision8.py` holds the preserved stroke corrections, `scripts/motion_refinements.py` for the prior pose/joint corrections, `scripts/motion_recipes.py` for base poses, `scripts/motion_volleys.py` for the two volleys and `config/motion-rhythm.json` for timing. Inspect the rebuilt GLB before accepting choreography. The editable master is `output/tennis-motion-master.blend`; manual Blender edits must be carried back to reproducible controls.

- `node scripts/review_server.mjs`: [MotionLab](http://127.0.0.1:4184/), paired local views, reviewed-phase selection, rhythm plot, frame stepping, joint diagnostics and grip close-up.
- `node scripts/gameplay_server.mjs`: [MotionSequence](http://127.0.0.1:4185/review/gameplay.html), thirteen events beginning with wide FH → FH → BH, including recovery/split/approach and net play. The Sequence selector also exposes 19 individual movement variants: three walking paces, run, four crossovers, four nudges, jump, split and five slide directions. Contacts 12 and 13 review volleys.
- `node scripts/check_gameplay.mjs`: repeat the actual controller/IK sweep against the published candidate.

Half-volley, lob, approach, overhead and one-handed-backhand labels still use core-motion proxies. No new technique clips for those labels, exact Djokovic reconstruction, owner visual approval, remote push or deployment is implied.

## Revision 9 verification

See the lab's `docs/motion-revision-9.md` and `docs/evidence/revision-9.json`. All 23 clips pass export, anatomy and choreography gates. At 240 Hz, 11 mixed shots per hand plus all 19 movement variants per hand have zero joint-envelope violations and retain sub-0.002 m contact error. The run's ankle peak is 0.288 m, versus the previous runtime's approximately 0.498 m; minimum knee-to-hip vertical separation is 0.206 m. Stance anchors, bounded root speed/acceleration, recovery position, same/opposite-side launches, deterministic seeking and three walking paces are covered by 218 passing frontend tests (22 files). The 20 lab JavaScript tests, four Python rhythm tests and production build pass; the existing large-chunk warning remains.

Browser review rendered all 19 variants and 834 samples spanning the complete 13-shot sequence. Seven preserved clips are byte-identical; the forehand differs only by at most 1.5e-7 in the exported racket quaternion (all skeletal tracks and timestamps are identical). Numerical and visual evidence supports owner review, not a claim of owner approval. Slides are explicit review primitives; normal hard-court recovery uses footsteps.

## Revision 10 service verification

All 23 clips pass 240 Hz anatomy/choreography and glTF validation with zero errors/warnings. All 22 other decoded clips and their metadata are exactly unchanged. Both-hand gameplay passes 11 mixed events plus 19 movement variants per hand with zero joint violations and contact error below .001 mm. Tests: 219 frontend / 22 files, 20 lab JavaScript, four Python rhythm; production build passes with the existing bundle-size advisory. Browser review includes overhead/three-quarter/front poses and complete service playback in both hands with no joint warnings. See the lab’s `docs/motion-revision-10.md` and `docs/evidence/revision-10.json`. Owner visual acceptance remains open.

## Articulated player replacement

The active character is now a 1.88 m CC0 Quaternius mannequin with smooth limb shells, visible dark joints and a faceless head. See `docs/assets/quaternius-articulated-mannequin.md` for the source and reproducible binder. It replaces the rejected semi-realistic candidate in the static carrier, Motion Lab and gameplay. All 23 revision-10 clips, decoded track values, timestamps and clip metadata are exactly preserved.

Gameplay keeps the mannequin's vertex colors and blends serve ground support continuously through landing. Motion Lab uses the same measured scale/floor calibration. Verification: 221 frontend tests, 20 lab JavaScript tests, four Python rhythm tests, full anatomy/choreography/gameplay gates and production build pass. Browser review includes both 13-shot sequences and all 19 movement variants. The lab's `docs/evidence/character-replacement.json` records hashes and measurements; owner visual acceptance is pending.
