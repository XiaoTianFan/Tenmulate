# Local opponent motion pipeline

- **Updated:** 2026-09-05
- **State:** Local pipeline and gameplay integration implemented; source-specific biomechanics remain owner-reviewable
- **Authority:** [ADR-0012](../decisions/0012-local-opponent-motion-pipeline.md)
- **Laboratory:** `F:/Codes/Tenmulate_motion_analysis`, an independent Git repository

## Selected evidence

Both 1080p recordings remain in `C:/Users/20378/Downloads/Video`; no footage is uploaded or committed. January is 16:29.495 at 59.94 fps; UCLA is 37:55.416 at 60 fps. Sparse timestamped contact sheets narrowed the search, then short dense samples established these stable takes. The recordings are independent views, not synchronized multi-camera reconstruction.

| Motion | Recording / source window | Contact estimate | Selection |
| --- | --- | --- | --- |
| Forehand | UCLA 02:00.000–02:02.400 | 02:00.983 | Rear semi-open, blue-shorts primary subject; complete body and balanced finish |
| Two-handed backhand | January 10:39.800–10:42.000 | 10:40.840 | Front/three-quarter primary subject; foreground selection excludes coach behind |
| Normal serve | January 13:54.850–13:57.900 | 13:56.486 | Toss, load, extension, left-foot landing and recovery |

UCLA 33:48.85–33:51.55 shows a **different grey-shorts performer**. It is secondary reference only, excluded from the primary/Djokovic-attributed set. Coarse navigation and subject/crop notes live in the lab's `docs/source-review.md` and `config/clips.json`.

## Production choice

Use local MediaPipe Heavy observations followed by source-informed Blender authoring on the existing 65-joint CC0 Quaternius carrier. All 145 forehand, 133 backhand and 184 serve frames have whole-body detections. Median visibility is .975/.972/.987, but hidden wrists/elbows can span 52/48/24 frames. Raw landmarks, confidence and interpolated candidates remain separate. The shoulder sequence contributes 35% of torso yaw; limbs, grip, feet, racket and recovery are explicit editable corrections. This is **not a claim of automatic or biomechanically exact Djokovic mocap**.

GVHMR was examined but excluded as a production dependency: its author setup requires registered body models and its license restricts commercial use. The CC0 Quaternius animation library supplies possible general locomotion references; this compact tennis-ready connector set is authored locally instead. No purchase or online solve was needed.

## Delivered contract

The baked 60 fps library has nine clips: `ready`, `split-step`, `move-left`, `move-right`, `move-forward`, `move-backward`, `forehand`, `backhand`, `serve`. Stroke durations are 2.4/2.2/3.05 seconds; contact markers are .983333/1.033333/1.633333. Every stroke recovers into the same ready pose. `recovery` marks the recovery phase's start; clip duration marks completion. The serve has a toss-release marker and separate string-bed contact node.

`public/assets/opponents/tennis-local-v1.5d58b024e87a.glb` is 1,157,060 bytes, SHA-256 `5d58b024e87a1b431eb353028714fbfa65f1c2b6135b5246af7a26d03e73f96c`. Its provenance manifest records source windows, observation/model/recipe/carrier hashes and Blender version. `src/content/opponent-motion.json` is the small runtime contract. Fresh extraction and rebuilding reproduced the same GLB digest.

The compiler treats repetition start times as contact/launch times. It adds preparation, recovery and reachable travel when an interval is too short, preserves rest duration, and lets the last ball finish before completion. The practice screen explains adjusted rhythm. Ball pace/spin remain independent physics settings. Compact serve rhythm samples the same clip at 1.25×; left-handed play is a mirrored adaptation.

The renderer and audio use the same absolute session clock. Seeks, pause, slow playback and replay resample deterministic poses. Root travel eases to zero velocity at boundaries with a 3.2 m/s peak limit. During long gaps the opponent completes travel, holds ready, then split-steps before preparation. World-space stance anchors, leg IK and hip reach correction avoid travel foot sliding. Contact is aligned to the original physics launch point with a smooth pelvis-height correction. The serve toss ends where exactly one outgoing ball begins. A 1.2 cm animated outline keeps crossed arms and fingers legible.

## Reproduce and adjust

In the lab, run `scripts/setup.ps1`, then `scripts/build.ps1 -Extract -Publish` through PowerShell. The latter checks subprocesses and validates before publication. Omit `-Extract` to reuse reviewed observations or `-Publish` to keep a candidate local. `-Blender` overrides the portable executable. Node utilities use the sibling frontend's installed dependencies.

Edit the metric poses in `scripts/build_motion_library.py`; rebuild and compare source, contact and follow-through before publishing. `output/tennis-motion-master.blend` has named editable NLA actions. Environments, weights, observations, sheets and masters stay in the lab. Manual Blender edits must be carried back into reproducible controls or a deliberately revised export step.

- `node scripts/review_server.mjs`: [frame/source review](http://127.0.0.1:4184).
- `node scripts/gameplay_server.mjs`: [six-shot sequence in the real frontend renderer](http://127.0.0.1:4185/review/gameplay.html). Baseline, approach, retreat, serves, both hands, pause, frame step and exact-contact controls.

## Verification and limits

The full frontend suite passed **171 tests / 20 files** and the production build passed. The existing large-renderer-chunk warning remains. glTF validation reports **zero errors and warnings**; publication binds that report to the exact asset digest.

Tests load/deform the exported skin, require all three contacts within 2 mm for both hands, and cover repeated/arbitrary seeks, reachable feet, continuous root travel, speed limits, cadence/rest bounds, toss handoff and audio event crossings. They caught and fixed paused-frame correction accumulation and unreachable stride targets.

In-app browser checks at 1280×720/900 verified meaningful pages, no framework overlay, healthy console, normal-speed sequence, player-distance/close silhouettes, clip/source selection, exact-contact controls and real practice pause → next repetition → slower playback. Paused forehand, backhand and serve impact frames held `contactError=0.00000`. A narrower review layout was inspected and its footer made persistent. This is desktop/browser evidence, not phone-device or endurance certification.

Only the three named strokes have source-informed choreography. Older volley, half-volley, lob, approach, overhead and one-handed-backhand labels use core-motion proxies; their physics remains supported, but their specific techniques are not captured. Exact Djokovic style, detailed close-up grip fidelity, mobile hardware, Firefox/Safari, long-session performance and owner visual approval remain separate review items. No remote push or deployment is implied.

## Primary sources

- [MediaPipe Python](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/python).
- [GVHMR repository](https://github.com/zju3dv/GVHMR), [license](https://raw.githubusercontent.com/zju3dv/GVHMR/main/LICENSE), [installation](https://raw.githubusercontent.com/zju3dv/GVHMR/main/docs/INSTALL.md).
- [Quaternius animation library](https://quaternius.com/packs/universalanimationlibrary.html).
- [Three.js AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html) and [AnimationAction](https://threejs.org/docs/pages/AnimationAction.html).
