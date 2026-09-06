# Local opponent motion pipeline

- **Updated:** 2026-09-06, revision 5
- **State:** Reference-led correction library integrated and mechanically verified; visual style remains owner-reviewable
- **Authority:** [ADR-0012](../decisions/0012-local-opponent-motion-pipeline.md)
- **Laboratory:** `F:/Codes/Tenmulate_motion_analysis`, independent Git repository
- **Revision-5 lab commit:** `5a9138b`. Evidence and the 11-image ledger are recorded in the lab's `docs/motion-revision-5.md` and `docs/evidence/revision-5.json`.

## Production method

The owner's latest annotated MotionLab review corrects revision 4's preparation, loading and recovery paths. Production uses **visual reference-led authoring**, explicit joint curves, calibrated anatomical fitting and Blender 5.2.1 baking. Forehand now preserves the side-facing preparation into takeback before low rearward lag. Backhand holds takeback, drops with a sideways face, and carries both hands across to a finish beside the head. Serve keeps the early racket forward, stays sideways through the baseline-facing drop with straighter legs, continues pronation through extension, then unwinds. Pelvis/chest pitch, side bend and head gaze remain independent of yaw. Extracted poses are not production inputs. All footage and intermediate work stay outside the frontend.

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

The 120 Hz library contains **13 clips**: ready, split-step, four `move-*` adjustments, run-forward, walk-forward, forehand, backhand, forehand-slice, backhand-slice and serve. The denser solve/bake preserves the supporting grip between frames during the fast backhand drop; temporal fitting bounds scale with elapsed time. All strokes return to shared ready. Forehand/backhand/serve durations remain **2.4 / 2.2 / 3.25 s**, with impact at **1.35 / 1.166667 / 1.783333 s**. Slices contact at 1.05/1.15 s. Serve toss release is at **.883333 s**.

`src/content/opponent-motion.json` identifies the content-hashed active GLB, size, digest and runtime timing contract. `public/assets/opponents/tennis-local-v1.manifest.json` binds visual references, carrier, authoring code, Blender version and rhythm curves. Revision 5 uses `tennis-local-v1.e5e5561ece9c.glb`, **2,102,144 bytes**, SHA-256 `e5e5561ece9c89b8d30e3515f22b92c84ebdcb6207241440bc93418c88a934aa`. The 3 MiB precache ceiling keeps this 2.01 MiB library available offline; the built worker includes its hash and excludes the superseded revision-4 asset, which remains in Git history.

`config/motion-rhythm.json` in the lab maps source seconds to authored pose coordinates through strictly monotone PCHIP curves. Every reviewed phase lands on its primary reference timestamp. The slow setup/toss, trophy hold, rapid serve acceleration and lower finish are separate anchors. Runtime uses the existing event `rate` to scale the whole baked curve, preserving contact/toss synchronization; it does not independently stretch selected phases.

The frontend owns absolute time, court placement, ball physics, camera and audio. Root travel eases to zero at boundaries. Routes of at least 1.8 m run with sagittal arm swing and rear heel recovery; 0.6–1.8 m routes walk; smaller routes use adjustment steps. Runtime leg IK preserves knee hinge planes and limits ankle rotation. Arm blends reconstruct the elbow hinge because ordinary quaternion blending can introduce sideways bending even between valid source poses. Corrections are restored before repeated or backward seeks.

Ball launches meet the actual string-bed anchor for all five strokes and either hand. Toss release includes the same vertical alignment correction as the animated wrist, then joins exactly one outgoing ball at contact. The compiler preserves complete strokes, reachable travel and configured rest duration, extending an interval when necessary. Rest itself supplies travel time, so adding rest is not always a constant translation of the no-rest schedule. Ball pace remains independent of stroke playback rate.

## Gates and verification

`config/anatomy-limits.json` in the lab defines explicit animation plausibility envelopes. The shared inspector measures **63 articulated joints**, bone-length preservation and **upper-arm plus forearm** torso clearance from actual exported transforms, independent of root yaw, scale or handedness. It reports joint, angle, limit and frame in place. Shoulder posterior excursion uses the frontal plane to avoid a false singularity at horizontal abduction. These are conservative animation checks, not clinical certification.

All clips are sampled at **240 Hz**, including between baked frames. Choreography gates retain signed striking face, grip placement, stable forehand wrist, straight toss elbow, contact, path continuity and clip closure checks. Revision 5 adds side-facing preparation, delayed loading, backhand racket/head clearance across the finish interval, extended serve legs and continued pronation followed by unwind. Clearance uses a conservative string-bed/shaft and head-sphere proxy, not a full skinned-mesh collision test. Continuity budgets retain their earlier equivalent time intervals. Anatomical angle limits are unchanged. Reports bind asset, limits and checker hashes; publication rejects missing, stale, failed or partial-library reports.

Current results are recorded in the lab's revision-5 ledger and evidence JSON. All 13 clips pass with zero glTF errors/warnings and zero joint violations. The new gates reject all three targeted revision-4 strokes. The actual controller passes nine events for both hands at 240 Hz after blending/IK, with .121 m minimum finish clearance and .00146 mm maximum contact error. **20 lab JavaScript tests, 3 Python rhythm tests, 202 frontend tests / 21 files and production build** pass. Annotated-frame and integrated mirrored/normal-playback browser review found no console errors/warnings. Desktop visual review remains separate from owner technique approval.

## Reproduce and collaborate

In the lab, run `scripts/setup.ps1`, then `scripts/build.ps1` through PowerShell. Add `-Publish` to copy a mechanically validated candidate to the frontend and run the gameplay gate. The old `-Extract` option is removed; optional pose diagnostics use `setup.ps1 -PoseDiagnostics` and `extract_pose.py` separately. `-Blender <path>` overrides the portable executable.

Edit `scripts/motion_refinements.py` for the current pose/joint corrections, `scripts/motion_recipes.py` for base poses and `config/motion-rhythm.json` for timing. Inspect the rebuilt GLB before accepting choreography. The editable master is `output/tennis-motion-master.blend`; manual Blender edits must be carried back to reproducible controls.

- `node scripts/review_server.mjs`: [MotionLab](http://127.0.0.1:4184/), paired local views, reviewed-phase selection, rhythm plot, frame stepping, joint diagnostics and grip close-up.
- `node scripts/gameplay_server.mjs`: [MotionSequence](http://127.0.0.1:4185/review/gameplay.html), ten events including running, walking, small adjustment, drives, slices and serve in the real scene.
- `node scripts/check_gameplay.mjs`: repeat the actual controller/IK sweep against the published candidate.

Older volley, half-volley, lob, approach, overhead and one-handed-backhand labels still use core-motion proxies. No new technique clips for those labels, exact Djokovic reconstruction, owner visual approval, remote push or deployment is implied.
