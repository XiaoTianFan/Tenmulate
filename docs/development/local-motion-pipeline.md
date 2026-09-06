# Local opponent motion pipeline

- **Updated:** 2026-09-06, revision 4
- **State:** Reference-led correction library integrated and mechanically verified; visual style remains owner-reviewable
- **Authority:** [ADR-0012](../decisions/0012-local-opponent-motion-pipeline.md)
- **Laboratory:** `F:/Codes/Tenmulate_motion_analysis`, independent Git repository
- **Revision-4 lab commits:** `a73cbe4` correction contract; `488219e` authored paths, rhythm, gates and verification. Evidence is recorded in the lab's `docs/motion-revision-4.md`.

## Production method

The owner's annotated MotionLab review rejected revision 3's choreography despite its joint-envelope passes. Production uses **visual reference-led authoring**, explicit joint curves, calibrated anatomical fitting and Blender 5.2.1 baking. Forehand and serve arm paths now have direct editable controls so fitting cannot trade away the intended preparation, drop or finish. Pelvis/chest pitch, side bend and head gaze are independent of yaw. Extracted monocular poses and MediaPipe weights are not production inputs. All footage and intermediate work stay outside the frontend.

The existing CC0 Quaternius carrier has 65 bones. Seven DOFs per arm separate shoulder swing/twist, elbow hinge, forearm rotation, wrist flexion and deviation. Fixed segment lengths prevent stretch; anatomical elbow/knee frames replace direction-only aiming. The racket stays rigid in the dominant hand. The left eastern backhand support grip uses bevel **7**, correcting the prior right-handed bevel-3 convention. Forehand preparation couples the support hand to the racket throat before release. Contact-anchored fitting and joint-space recovery avoid wrong forearm branches and reset discontinuities.

## Local evidence and review

The original January and UCLA recordings remain under `C:/Users/20378/Downloads/Video`. They are independent takes, not simultaneous multiview capture. Both MotionLab and MotionSequence always display front/rear reference panels below the 3D scene, aligned by named phases from one motion clock.

| Motion | Default frontal take | Rear |
| --- | --- | --- |
| Forehand | UCLA 13:43.2–13:45.6, impact 13:44.550 | UCLA 02:00–02:02.4, impact 02:00.983 |
| Two-handed backhand | UCLA 13:40.6–13:42.8, impact 13:41.767 | UCLA 09:44.8–09:47.2, impact 09:45.917 |
| Serve | UCLA 28:03.35–28:06.6, impact 28:05.133 | UCLA 33:48.85–33:51.55, **secondary grey-shorts performer**, comparison only |
| Walking / travel | January relaxed-walk context where assigned | UCLA lateral-recovery context where assigned |
| Slices | No verified complete clean take | No verified complete clean take |

The owner supplied approximate UCLA starting regions; bounded frame inspection selected these complete repetitions nearby. Previous January three-quarter takes remain in the reference registry. Missing views and contextual/secondary footage are explicitly labeled. Slices and generic gait are authored technique, not claimed Djokovic capture. The carrier's proportions and exact personal style still require visual judgment.

## Library and gameplay

The 60 Hz library contains **13 clips**: ready, split-step, four `move-*` adjustments, run-forward, walk-forward, forehand, backhand, forehand-slice, backhand-slice and serve. All strokes return to shared ready. Forehand/backhand/serve durations are **2.4 / 2.2 / 3.25 s**, with impact at **1.35 / 1.166667 / 1.783333 s**. Slices contact at 1.05/1.15 s. Serve toss release is at **.883333 s**.

`src/content/opponent-motion.json` identifies the content-hashed active GLB, size, digest and runtime timing contract. `public/assets/opponents/tennis-local-v1.manifest.json` binds visual references, carrier, authoring code, Blender version and rhythm curves. The lab's revision-4 evidence record identifies the exact validated asset. Superseded active assets remain in Git history.

`config/motion-rhythm.json` in the lab maps source seconds to authored pose coordinates through strictly monotone PCHIP curves. Every reviewed phase lands on its primary reference timestamp. The slow setup/toss, trophy hold, rapid serve acceleration and lower finish are separate anchors. Runtime uses the existing event `rate` to scale the whole baked curve, preserving contact/toss synchronization; it does not independently stretch selected phases.

The frontend owns absolute time, court placement, ball physics, camera and audio. Root travel eases to zero at boundaries. Routes of at least 1.8 m run with sagittal arm swing and rear heel recovery; 0.6–1.8 m routes walk; smaller routes use adjustment steps. Runtime leg IK preserves knee hinge planes and limits ankle rotation. Arm blends reconstruct the elbow hinge because ordinary quaternion blending can introduce sideways bending even between valid source poses. Corrections are restored before repeated or backward seeks.

Ball launches meet the actual string-bed anchor for all five strokes and either hand. Toss release includes the same vertical alignment correction as the animated wrist, then joins exactly one outgoing ball at contact. The compiler preserves complete strokes, reachable travel and configured rest duration, extending an interval when necessary. Rest itself supplies travel time, so adding rest is not always a constant translation of the no-rest schedule. Ball pace remains independent of stroke playback rate.

## Gates and verification

`config/anatomy-limits.json` in the lab defines explicit animation plausibility envelopes. The shared inspector measures **63 articulated joints**, bone-length preservation and **upper-arm plus forearm** torso clearance from actual exported transforms, independent of root yaw, scale or handedness. It reports joint, angle, limit and frame in place. Shoulder posterior excursion uses the frontal plane to avoid a false singularity at horizontal abduction. These are conservative animation checks, not clinical certification.

All clips are sampled at **120 Hz**, including between baked frames. Choreography gates check signed striking face, real grip placement, stable forehand wrist, straight toss elbow, extended serve contact, path continuity and clip closure. Revision 4 also checks rearward takeback, backhand foot stagger, folded finishes, delayed toss/lift, upward gaze, racket drop and running inclination. Path checks distinguish the fast source-paced service strike from abrupt velocity changes. Anatomical angle limits are unchanged. Reports bind asset, limits and checker hashes; publication rejects missing, stale, failed or partial-library reports.

Current validation results and measured errors are recorded in the lab's `docs/motion-revision-4.md` and `docs/evidence/revision-4.json`. The stronger upper-arm check rejects all five revision-3 strokes, which is retained as negative evidence. Desktop visual review remains separate from owner technique approval.

## Reproduce and collaborate

In the lab, run `scripts/setup.ps1`, then `scripts/build.ps1` through PowerShell. Add `-Publish` to copy a mechanically validated candidate to the frontend and run the gameplay gate. The old `-Extract` option is removed; optional pose diagnostics use `setup.ps1 -PoseDiagnostics` and `extract_pose.py` separately. `-Blender <path>` overrides the portable executable.

Edit `scripts/motion_refinements.py` for the current pose/joint corrections, `scripts/motion_recipes.py` for base poses and `config/motion-rhythm.json` for timing. Inspect the rebuilt GLB before accepting choreography. The editable master is `output/tennis-motion-master.blend`; manual Blender edits must be carried back to reproducible controls.

- `node scripts/review_server.mjs`: [MotionLab](http://127.0.0.1:4184/), paired local views, reviewed-phase selection, rhythm plot, frame stepping, joint diagnostics and grip close-up.
- `node scripts/gameplay_server.mjs`: [MotionSequence](http://127.0.0.1:4185/review/gameplay.html), ten events including running, walking, small adjustment, drives, slices and serve in the real scene.
- `node scripts/check_gameplay.mjs`: repeat the actual controller/IK sweep against the published candidate.

Older volley, half-volley, lob, approach, overhead and one-handed-backhand labels still use core-motion proxies. No new technique clips for those labels, exact Djokovic reconstruction, owner visual approval, remote push or deployment is implied.
