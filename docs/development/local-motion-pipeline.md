# Local opponent motion pipeline

Current runtime contract, reconciled 2026-09-07. [ADR-0012](../decisions/0012-local-opponent-motion-pipeline.md) establishes the local production boundary; [ADR-0014](../decisions/0014-articulated-player-and-complete-motion-library.md) records the current model and library. The [integration receipt](motion-main-integration-2026-09-07.md) separates merge, automated checks, live review and remaining release gates.

## Authority and ownership

| Surface | Authority |
| --- | --- |
| Gameplay, ball flight, session clock, world travel and foot correction | This repository: `compileSession.ts`, `opponentTimeline.ts`, `opponentMovement.ts`, `OpponentRig.ts`, `TennisScene.ts` |
| Active animation URL, hash, clip clocks, contact anchors, scale and floor offset | `src/content/opponent-motion.json` |
| Model identity and nominal height | `src/content/opponent-asset.json`; [asset record](../assets/quaternius-articulated-mannequin.md) |
| Published provenance and detailed phase metadata | `public/assets/opponents/tennis-local-v1.manifest.json` |
| Sources, recipes, anatomical fitting, Blender bake and motion evidence | Independent sibling repository `F:/Codes/Tenmulate_motion_analysis`; its README and `docs/README.md` |
| Historical corrections | Lab `docs/motion-revision-2.md` through `motion-revision-13.md`, volley/model/compact records and `docs/evidence/` |

Production is **visual reference-led authoring**, constrained joint fitting and Blender baking. Extracted monocular poses are optional diagnostic experiments, not production inputs. Source videos, models, Python environments, filmstrips and editable Blender masters stay in the lab. No runtime inference or cloud mocap service is required.

## Active model and library

The 1.88 m CC0 Quaternius articulated mannequin has a faceless head, smooth limb panels and dark joints on the established 65-bone tennis armature. The old semi-realistic body is a retained skeleton/provenance source, not the displayed player. The runtime loads a single GLB containing the bound model, rigid racket and all animations.

Active bundle: `tennis-local-v1.f313ece32de3.glb`, **2,993,676 bytes**.
SHA-256: `f313ece32de3db2f70f3e45ec07a947774c7552a3533fb85bf5c39d74c356e45`.

| Group | Clips |
| --- | --- |
| Shared stance | `ready`, `split-step` |
| Groundstrokes | `forehand`, `backhand`, `forehand-slice`, `backhand-slice` |
| Volleys | `forehand-volley`, `backhand-volley` |
| Serves | `serve`, `serve-compact` |
| Gait and adjustment | `run-forward`, `walk-forward`, `move-left`, `move-right`, `move-forward`, `move-backward` |
| Crossover | `cross-front-left`, `cross-front-right`, `cross-back-left`, `cross-back-right` |
| Other movement | `jump`, `slide-left`, `slide-right`, `slide-forward` |

All **24 clips** share calibrated boundaries and the same rig. The compact addition preserves the prior 23 clip layouts, timestamps and metadata; 22 have identical decoded values, while the forehand has a maximum float difference of **1.7881393e-7** within the existing 2e-7 preservation tolerance. It is inaccurate to call every track bit-identical.

## Stroke and movement behavior

Forehand preparation and lag follow the rear UCLA take's rhythm/height rather than the low-ball frontal take. A stable roughly 48-degree elbow follows a low-to-high hitting arc; the pelvis stays sideways longer as the shoulders rotate to contact. Backhand retains its deeper coil, two-hand grip, smooth drop and delayed pelvis release. Both volleys have distinct compact punches, controlled balancing arms and held chest turns. The six groundstroke/slice/volley clips widen the stance and lower the pelvis through the shot.

Ready, split and movement share a two-hand belly/chest carry and forward athletic lean. Running uses rear heel recovery with distance-driven cadence. Crossovers rotate and translate the pelvis and use mirrored anatomical leading-foot selection, avoiding the former deep squat from unreachable foot targets.

`strokeForShot` resolves serve rhythm, then overhead's normal-serve proxy, stroke side and volley family before spin. Slices select their own clips. **Half-volley, overhead and one-handed-backhand labels still use core-motion proxies**; they are not newly captured dedicated techniques.

Automatic session recovery goes toward a handed baseline-center bias, turns toward the net, split-steps for 0.6 s, then approaches the next shot. Wide lateral recovery starts with a front crossover. Routes of at least 1.65 m run; 0.65–1.65 m walk; shorter routes adjust. The planner reserves complete strokes, travel and rest rather than teleporting or compressing a stroke. Final shots also recover. Speed and travel-acceleration bounds are 4.8 m/s and 6.5 m/s², authored limits rather than athlete measurements.

The same runtime supports 19 explicit movement review drills, including back crossovers, jump and sideways/forward/diagonal slides. Automatic hard-court recovery uses footsteps; merely bundling a slide does not make every recovery a slide. `sampleMovementDrill` provides explicit variants for future gameplay selection without a second animator.

## Two serve rhythms in actual practice

Select **Return**, then **Opponent → Serve rhythm**. Choose Normal or Compact. The drill editor also supports a per-event override. Resolution is explicit event override → practice setting → shot preset; undefined defaults to normal.

| Clip | Toss release | Contact | Full cycle |
| --- | ---: | ---: | ---: |
| Normal `serve` | 0.883 s | 1.783 s | 3.250 s |
| Compact `serve-compact` | 0.633 s | 1.300 s | 2.400 s |

Both run at their authored rate of 1. Compact is a distinct pinpoint gather, low toss, early pickup and quick launch, not normal sped up by 1.25×. The source is the owner's Kyrgios clip: first-pass cadence plus same-camera slow replay for geometry. At equal 2.75 m contact height, measured toss apices are 3.256 m normal and 2.874 m compact.

The toss starts at the corrected release hand, follows a ballistic path and hands over to the outgoing ball at contact. Rhythm does not change outgoing ball physics. Both handedness settings use the same validated mirroring, contact alignment and airborne knee-plane preservation.

## Build, publish and review

From the lab:

1. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1`; install frontend dependencies with `npm ci`.
2. Verify local sources in `config/sources.json` and phase/view authority in `config/references.json`.
3. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build.ps1 -Publish` builds previews, solves, bakes, checks export/choreography/anatomy, publishes and validates the actual consumer.
4. Run the relevant preservation check when refining an existing library. Compact preservation uses `node scripts/check_compact_preservation.mjs` and its retained baseline.
5. In this frontend run `npm run check:motion`, `npm test`, `npm run build`.

Publication rejects failed/stale/partial reports. The consumer check independently verifies model/library hashes, metadata, clips and calibration. The production build also checks that its service worker precaches **only the selected opponent GLB**. Older bundles remain on disk for evidence and rollback; changing an asset pointer alone is not a safe rollback because metadata/calibration must agree.

Review services run in separate terminals:

| Working directory | Command | URL |
| --- | --- | --- |
| Frontend | `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` | `http://127.0.0.1:5173/` — actual practice |
| Lab | `node scripts/review_server.mjs` | `http://127.0.0.1:4184/` — phase/source comparison |
| Lab | `node scripts/gameplay_server.mjs` | `http://127.0.0.1:4185/review/gameplay.html` — actual renderer with review controls |

The normal/compact comparison is `?sequence=serves` on the gameplay review URL. The frontend's unoverridden Vite default is port 4173; 5173 is the explicit review command above. These local services are not a public deployment.

## Evidence and limits

Blender bakes at 120 Hz. The lab checks exported and interpolated poses at 240 Hz: 63 articulated joints, fixed lengths, grips, signed racket face, clearance proxies, contact, stance, continuity and clip closure. Both-hand gameplay repeats checks after real blending/IK, including 38 movement sweeps and crossover support checks. These are animation plausibility gates, not clinical certification or complete mesh-collision testing.

Visual review must include normal-speed playback, frame stepping and representative front/rear/side/gameplay views. Independent reference takes align by named phase; missing views and secondary performers stay labeled. The compact replay is explicitly the same camera. Tests do not replace the owner's technique review.

Public hosting, public provenance review, target-device performance and final owner technique acceptance remain separate release gates. See the integration receipt for the current verification run; historical revision test counts are not current suite totals.
