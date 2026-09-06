# Local opponent motion pipeline

- **Updated:** 2026-09-06, revision 7 after the volley addition
- **State:** Fifteen-clip reference-led library integrated and mechanically verified; visual style remains owner-reviewable
- **Authority:** [ADR-0012](../decisions/0012-local-opponent-motion-pipeline.md)
- **Laboratory:** `F:/Codes/Tenmulate_motion_analysis`, independent Git repository
- **Revision-6 lab commit:** `0399730`. Evidence and the six-image ledger are recorded in the lab's `docs/motion-revision-6.md` and `docs/evidence/revision-6.json`.
- **Volley lab commits:** source/contract `12c8863`, implementation and verification `c0eda97`. See the lab's `docs/volley-motion.md` and `docs/evidence/volleys.json`.
- **Revision-7 lab commits:** annotation contract `bac6d64`, implementation/evidence `e5a855c`. See `docs/motion-revision-7.md` and `docs/evidence/revision-7.json` in the lab.

## Production method

The owner's latest eight-image review adds a distinct backward-pointing forehand racket lag with the hand advancing, while the support arm stays along the baseline through the completed turn. Backhand preparation turns beyond 90 degrees with the front shoulder lower. Serve cocking gains a deeper chest arch and keeps the upper arm near the tilted shoulder line; contact adds shoulder-over-shoulder reach and a small forward core tuck beneath an overhead racket. Backhand volley holds a sideways chest through its finish and uses a bent balance arm, shared with backhand slice. Forehand volley keeps its bent balance hand forward. Production remains visual reference-led authoring, calibrated anatomical fitting and Blender 5.2.1 baking. Prior carry, toss, footwork and recovery corrections remain, and extracted poses are not production inputs.

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

The 120 Hz library contains **15 clips**: ready, split-step, four `move-*` adjustments, run-forward, walk-forward, forehand, backhand, forehand-slice, backhand-slice, serve, **forehand-volley and backhand-volley**. The denser solve/bake preserves the supporting grip between frames during the fast backhand drop; temporal fitting bounds scale with elapsed time. All strokes return to shared ready. Forehand/backhand/serve durations remain **2.4 / 2.2 / 3.25 s**, with impact at **1.35 / 1.166667 / 1.783333 s**. Slices contact at 1.05/1.15 s. Serve toss release is at **.883333 s**. Both volleys last **1.8 s**, with contact at **.700 / .583333 s**.

`src/content/opponent-motion.json` identifies the content-hashed active GLB, size, digest and runtime timing contract. `public/assets/opponents/tennis-local-v1.manifest.json` binds visual references, carrier, authoring code, Blender version and rhythm curves. Revision 7 uses `tennis-local-v1.1e18ac0ca2cc.glb`, **2,431,164 bytes**, SHA-256 `1e18ac0ca2ccb0ef8fc4e5231d86fd02766b93ebb6e45aecc4c05916134c1689`. The existing 3 MiB precache ceiling supports this 2.32 MiB library; the built worker includes its hash and excludes the superseded volley-addition asset, which remains in Git history.

Volleys use a compact continental preparation, an opposite-foot forward step and a short descending punch. Backhand preparation is guided at the throat, then releases into one-handed contact; both sides recover to the shared two-hand ready carry. Source-phase curves retain the inspected volley cadence. `strokeForShot` selects volley family before spin, so existing slice-labeled volley presets now use the new technique. Explicit side, inferred court position, practice volley selection and handedness work through the existing compiler. Half-volley remains its prior proxy. All nine clips outside the six revised motions have identical decoded animation tracks to the previous library. The backhand volley releases support before its punch so the departing hand cannot drag the racket off the compact path.

`config/motion-rhythm.json` in the lab maps source seconds to authored pose coordinates through monotone PCHIP curves. Groundstrokes then pace the measured racket arc, with an additional hand-distance term for forehand, to build speed into contact and decelerate toward the finish. One inverse arc map drives the whole body and both arms; the supporting backhand arm is refitted after interpolation. Contact and total duration stay exact. Intermediate named phases follow their original poses along the new curve, and local references remain aligned by semantic phase. MotionLab displays actual exported racket speed for the two drives. Forehand now has separate closed **Load** and backward **Lag** phases. After path pacing, Lag is at **1.257 s**, aligned to UCLA **13:44.483 front / 02:00.880 rear**. Serve retains its source-phase clock. Runtime uses the existing event `rate` to scale the whole baked curve, preserving contact/toss synchronization; it does not independently stretch selected phases.

The frontend owns absolute time, court placement, ball physics, camera and audio. Root travel eases to zero at boundaries. Routes of at least 1.8 m run with rear heel recovery and the shared two-hand carry; 0.6–1.8 m routes walk; smaller routes use adjustment steps. Runtime leg IK preserves knee hinge planes and limits ankle rotation. Arm blends reconstruct the elbow hinge because ordinary quaternion blending can introduce sideways bending even between valid source poses. Corrections are restored before repeated or backward seeks.

Ball launches meet the actual string-bed anchor for all seven stroke clips and either hand. Toss release includes the same vertical alignment correction as the animated wrist, then joins exactly one outgoing ball at contact. The compiler preserves complete strokes, reachable travel and configured rest duration, extending an interval when necessary. Rest itself supplies travel time, so adding rest is not always a constant translation of the no-rest schedule. Ball pace remains independent of stroke playback rate.

## Gates and verification

`config/anatomy-limits.json` in the lab defines explicit animation plausibility envelopes. The shared inspector measures **63 articulated joints**, bone-length preservation and **upper-arm plus forearm** torso clearance from actual exported transforms, independent of root yaw, scale or handedness. It reports joint, angle, limit and frame in place. Shoulder posterior excursion uses the frontal plane to avoid a false singularity at horizontal abduction. These are conservative animation checks, not clinical certification.

All clips are sampled at **240 Hz**, including between baked frames. Choreography gates retain signed striking face, grip placement, stable forehand wrist, straight toss elbow, contact, path continuity and clip closure checks. Revision 6 adds lifted preparation elbows, the extended baseline-facing forehand takeback and horizontal closed load, correct toss shoulder tilt/downward racket, physical speed peaks near contact and decreasing follow-through speed, plus the full two-hand carry/sight-clearance interval and gait sway. Revision-5 head clearance, serve leg extension and pronation/unwind gates remain. Revision 7 adds baseline-directed support, backward shaft lag with an advancing hand, deeper backhand coil/front-shoulder tilt, serve cocking elbow-line and overhead contact/tuck checks, sustained backhand-volley turn and bent balance arms. Chest turn is checked separately from the unchanged compact volley arc limit. Clearance uses string-bed/shaft and head-sphere proxies, not a full skinned-mesh collision test. Continuity budgets and anatomical angle limits are unchanged. Reports bind asset, limits and checker hashes; publication rejects missing, stale, failed or partial-library reports.

Current results are recorded in the lab's `docs/motion-revision-7.md` and `docs/evidence/revision-7.json`. All 15 clips pass at 240 Hz with zero glTF errors/warnings and zero joint violations. The new checker rejects the previous forehand, backhand, serve and both volleys for the annotated defects. The actual controller passes 11 automated mixed events for each hand after blending/IK, with maximum contact error **0.0012 mm**. **20 lab JavaScript tests, four Python rhythm tests, 208 frontend tests / 21 files and the production build** pass. Browser review covered the marked groundstroke and serve phases, volley/slice balance, both gameplay hands, and continuous approach/volley/walking-recovery playback. Every captured gameplay frame retained the post-IK joint pass. The active asset is precached; no browser errors or warnings were captured. The existing build chunk-size warning remains. These checks support the next owner technique review; they do not constitute owner approval.

## Reproduce and collaborate

In the lab, run `scripts/setup.ps1`, then `scripts/build.ps1` through PowerShell. Add `-Publish` to copy a mechanically validated candidate to the frontend and run the gameplay gate. The old `-Extract` option is removed; optional pose diagnostics use `setup.ps1 -PoseDiagnostics` and `extract_pose.py` separately. `-Blender <path>` overrides the portable executable.

Edit `scripts/motion_revision7.py` for the current focused corrections, `scripts/motion_refinements.py` for the prior pose/joint corrections, `scripts/motion_recipes.py` for base poses, `scripts/motion_volleys.py` for the two volleys and `config/motion-rhythm.json` for timing. Inspect the rebuilt GLB before accepting choreography. The editable master is `output/tennis-motion-master.blend`; manual Blender edits must be carried back to reproducible controls.

- `node scripts/review_server.mjs`: [MotionLab](http://127.0.0.1:4184/), paired local views, reviewed-phase selection, rhythm plot, frame stepping, joint diagnostics and grip close-up.
- `node scripts/gameplay_server.mjs`: [MotionSequence](http://127.0.0.1:4185/review/gameplay.html), twelve events including running, walking, small adjustment, drives, slices, serve and both volleys in the real scene. Contacts 11 and 12 review the volleys.
- `node scripts/check_gameplay.mjs`: repeat the actual controller/IK sweep against the published candidate.

Half-volley, lob, approach, overhead and one-handed-backhand labels still use core-motion proxies. No new technique clips for those labels, exact Djokovic reconstruction, owner visual approval, remote push or deployment is implied.
