# Local opponent motion pipeline

- **Updated:** 2026-09-05, revision 3
- **State:** Reference-led correction library integrated and mechanically verified; visual style remains owner-reviewable
- **Authority:** [ADR-0012](../decisions/0012-local-opponent-motion-pipeline.md)
- **Laboratory:** `F:/Codes/Tenmulate_motion_analysis`, independent Git repository
- **Lab commits:** `cfdbe41` correction contract, `bbc0065` paired references and joint inspector, `47a959d` constrained authoring, gait and gameplay validation

## Production method

The owner's MotionLab review rejected revision 2 despite its contact and grip checks passing. Production now uses **visual reference-led authoring**, calibrated anatomical joint-space fitting and Blender 5.2.1 baking. Extracted monocular poses and MediaPipe weights are not production inputs. Pose extraction remains an optional diagnostic experiment in the lab. All footage and intermediate work stay outside the frontend.

The existing CC0 Quaternius carrier has 65 bones. Seven DOFs per arm separate shoulder swing/twist, elbow hinge, forearm rotation, wrist flexion and deviation. Fixed segment lengths prevent stretch; anatomical elbow/knee frames replace direction-only aiming. The racket stays rigid in the dominant hand. The left eastern backhand support grip uses bevel **7**, correcting the prior right-handed bevel-3 convention. Forehand preparation couples the support hand to the racket throat before release. Contact-anchored fitting and joint-space recovery avoid wrong forearm branches and reset discontinuities.

## Local evidence and review

The original January and UCLA recordings remain under `C:/Users/20378/Downloads/Video`. They are independent takes, not simultaneous multiview capture. Both MotionLab and MotionSequence always display front/rear reference panels below the 3D scene, aligned by named phases from one motion clock.

| Motion | Front / three-quarter | Rear |
| --- | --- | --- |
| Forehand | January 11:22.2–11:24.6, impact 11:23.3 | UCLA 02:00–02:02.4, impact 02:00.983 |
| Two-handed backhand | January 10:39.8–10:42, impact 10:40.840 | UCLA 09:44.8–09:47.2, impact 09:45.917 |
| Serve | January 13:54.85–13:57.9, impact 13:56.486 | UCLA 33:48.85–33:51.55, **secondary grey-shorts performer**, comparison only |
| Walking / travel | January relaxed-walk context where assigned | UCLA lateral-recovery context where assigned |
| Slices | No verified complete clean take | No verified complete clean take |

Missing views and contextual/secondary footage are explicitly labeled. Slices and generic gait are authored technique, not claimed Djokovic capture. The carrier's proportions and exact personal style still require visual judgment.

## Library and gameplay

The 60 Hz library contains **13 clips**: ready, split-step, four `move-*` adjustments, run-forward, walk-forward, forehand, backhand, forehand-slice, backhand-slice and serve. All strokes return to shared ready. Drives/serve retain 2.4/2.2/3.05 s durations with impact at .983333/1.033333/1.633333 s; slices contact at 1.05/1.15 s. The serve has a separate toss-release marker.

The shipped file is `public/assets/opponents/tennis-local-v1.11b6f128f7d0.glb`, **1,645,868 bytes**, SHA-256 `11b6f128f7d0a4ecfc816e0e1bda57c832b53b845ce8aa804cf896d90444203a`. Its provenance manifest binds visual references, carrier, authoring code and Blender version. `src/content/opponent-motion.json` supplies the runtime contract. The superseded revision-2 GLB was removed from the active asset directory; Git retains it.

The frontend owns absolute time, court placement, ball physics, camera and audio. Root travel eases to zero at boundaries. Routes of at least 1.8 m run with sagittal arm swing and rear heel recovery; 0.6–1.8 m routes walk; smaller routes use adjustment steps. Runtime leg IK preserves knee hinge planes and limits ankle rotation. Arm blends reconstruct the elbow hinge because ordinary quaternion blending can introduce sideways bending even between valid source poses. Corrections are restored before repeated or backward seeks.

Ball launches meet the actual string-bed anchor for all five strokes and either hand. Toss release includes the same vertical alignment correction as the animated wrist, then joins exactly one outgoing ball at contact. The compiler preserves complete strokes, reachable travel and configured rest duration, extending an interval when necessary. Rest itself supplies travel time, so adding rest is not always a constant translation of the no-rest schedule. Ball pace remains independent of stroke playback rate.

## Gates and verification

`config/anatomy-limits.json` in the lab defines explicit animation plausibility envelopes. The shared inspector measures **63 articulated joints**, bone-length preservation and forearm/inner-torso clearance from actual exported transforms, independent of root yaw, scale or handedness. It reports joint, angle, limit and frame in place. Shoulder posterior excursion uses the frontal plane to avoid a false singularity at horizontal abduction. These are conservative animation checks, not clinical certification.

All clips are sampled at **120 Hz**, including between baked frames. Choreography gates check signed striking face, real grip placement, stable forehand wrist, straight toss elbow, extended serve contact, path continuity and clip closure. Reports bind asset, limits and checker hashes; publication rejects missing, stale or failed reports.

- All **12 revision-2 clips fail** the new inspector; all **13 revised clips pass**.
- **11 lab tests pass**, including invalid elbow/wrist/shoulder/stretch fixtures, mirror invariance, the shoulder-projection regression and reference-clock mapping.
- The real frontend controller passes a nine-event, two-hand **120 Hz** sweep after blending and foot IK with **zero joint violations**. Maximum measured impact error is approximately **0.0011 mm**.
- **202 frontend tests / 21 files pass**; production build passes. The existing large renderer chunk warning remains.
- Agent visual review covered preparation, acceleration, impact and recovery, front/rear/side views, every movement clip, and representative real-renderer playback. Desktop review is separate from owner biomechanics approval or device endurance certification.

Detailed correction notes, primary range/axis sources and machine-readable evidence are in the lab's `docs/motion-revision-3.md` and `docs/evidence/revision-3.json`. Earlier revision-2 acceptance claims are superseded by the owner's review and this record.

## Reproduce and collaborate

In the lab, run `scripts/setup.ps1`, then `scripts/build.ps1` through PowerShell. Add `-Publish` to copy a mechanically validated candidate to the frontend and run the gameplay gate. The old `-Extract` option is removed; optional pose diagnostics use `setup.ps1 -PoseDiagnostics` and `extract_pose.py` separately. `-Blender <path>` overrides the portable executable.

Edit `scripts/motion_recipes.py` and `scripts/anatomical_solver.py`. Inspect the rebuilt GLB before accepting choreography. The editable master is `output/tennis-motion-master.blend`; manual Blender edits must be carried back to reproducible controls.

- `node scripts/review_server.mjs`: [MotionLab](http://127.0.0.1:4184/), paired local views, frame stepping, joint diagnostics and grip close-up.
- `node scripts/gameplay_server.mjs`: [MotionSequence](http://127.0.0.1:4185/review/gameplay.html), ten events including running, walking, small adjustment, drives, slices and serve in the real scene.
- `node scripts/check_gameplay.mjs`: repeat the actual controller/IK sweep against the published candidate.

Older volley, half-volley, lob, approach, overhead and one-handed-backhand labels still use core-motion proxies. No new technique clips for those labels, exact Djokovic reconstruction, owner visual approval, remote push or deployment is implied.
