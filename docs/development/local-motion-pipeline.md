# Local opponent motion pipeline

- **Updated:** 2026-09-05
- **State:** Local pipeline and gameplay integration implemented; source-specific biomechanics remain owner-reviewable
- **Authority:** [ADR-0012](../decisions/0012-local-opponent-motion-pipeline.md)
- **Laboratory:** `F:/Codes/Tenmulate_motion_analysis`, an independent Git repository
- **Lab revision:** `5db7660` records the second-iteration contract; `502ddc9` contains its recipes, constraints, export checks and review tools.

## Selected evidence

Both 1080p recordings remain in `C:/Users/20378/Downloads/Video`; no footage is uploaded or committed. January is 16:29.495 at 59.94 fps; UCLA is 37:55.416 at 60 fps. Sparse timestamped contact sheets narrowed the search, then short dense samples established these stable takes. The recordings are independent views, not synchronized multi-camera reconstruction.

| Motion | Recording / source window | Contact estimate | Selection |
| --- | --- | --- | --- |
| Forehand | UCLA 02:00.000–02:02.400 | 02:00.983 | Rear semi-open, blue-shorts primary subject; complete body and balanced finish |
| Two-handed backhand | January 10:39.800–10:42.000 | 10:40.840 | Front/three-quarter primary subject; foreground selection excludes coach behind |
| Normal serve | January 13:54.850–13:57.900 | 13:56.486 | Toss, load, extension, left-foot landing and recovery |

UCLA 33:48.85–33:51.55 shows a **different grey-shorts performer**. It is secondary reference only, excluded from the primary/Djokovic-attributed set. Coarse navigation and subject/crop notes live in the lab's `docs/source-review.md` and `config/clips.json`.

## Production choice

Use local MediaPipe Heavy observations followed by source-informed Blender authoring on the existing 65-joint CC0 Quaternius carrier. All 145 forehand, 133 backhand and 184 serve frames have whole-body detections. Median visibility is .975/.972/.987, but hidden wrists/elbows can span 52/48/24 frames. Raw landmarks, confidence and interpolated candidates remain separate. The second iteration replaces the initial 35% relative-yaw blend with reviewed preparation/contact/recovery poses, so uncertain monocular angles cannot wash out the unit turn. Limbs, grip, feet, racket and recovery remain explicit corrections, not biomechanically exact Djokovic mocap.

GVHMR was examined but excluded as a production dependency: its author setup requires registered body models and its license restricts commercial use. The CC0 Quaternius animation library supplies possible general locomotion references; this compact tennis-ready connector set is authored locally instead. No purchase or online solve was needed.

## Delivered contract

The baked 60 fps library has twelve clips: `ready`, `split-step`, four `move-*` adjustments, `run-forward`, `forehand`, `backhand`, `forehand-slice`, `backhand-slice`, `serve`. Drives/serve retain 2.4/2.2/3.05 s durations and .983333/1.033333/1.633333 contact times. Forehand/backhand slices last 2.4/2.6 s with contacts at 1.05/1.15 s. All five strokes recover to the same ready pose. The serve has a toss-release marker and separate string-bed contact node.

Preparation now sustains approximately 90–100 degrees of shoulder turn, then unwinds through contact and finish. The octagonal handle and actual index knuckle express continental ready/serve/slices/backhand dominant grip, semi-western forehand and eastern supporting backhand grip. Both arms constrain the shared backhand handle; fingers/thumb wrap it. Serve racket face rotation is independent of grip, allowing the edge-led load and pronation. Intermediate poses prevent shaft reversals and face-normal flips. Both slices use high preparation, an open face and a forward, approximately level finish; the backhand slice releases the support arm into a balancing counter-motion.

`public/assets/opponents/tennis-local-v1.7bd907f40b37.glb` is 1,486,416 bytes, SHA-256 `7bd907f40b37ba30f16d34d3e98e48bff2ea0c982912421edf12dacdbc884238`. Its manifest records source windows, observation/model/recipe/carrier hashes and Blender version. `src/content/opponent-motion.json` is the runtime contract. Both export and choreography validation must refer to this digest before publication. Rebuilding with retained observations reproduced the same asset digest.

The compiler treats repetition start times as contact/launch times. It adds preparation, recovery and reachable travel when an interval is too short, preserves rest duration, and lets the last ball finish before completion. The practice screen explains adjusted rhythm. Ball pace/spin remain independent physics settings. Compact serve rhythm samples the same clip at 1.25×; left-handed play is a mirrored adaptation.

The renderer and audio use the same absolute session clock. Seeks, pause, slow playback and replay resample deterministic poses. Travel eases to zero velocity at boundaries within a 4.8 m/s limit. Routes of at least 1.8 m turn into a full running cycle with narrow support lanes, .58 s cadence, 38% stance time per foot and brief flight phases. Larger strides close the distance, then shorten as travel decelerates and the body turns into the next preparation. Short routes use adjustment steps. The head counter-turns toward play. World-space stance anchors, leg IK and hip reach correction keep feet reachable and planted; procedural corrections are restored before repeated samples. Contact still meets the original physics launch point and the serve toss hands off to one outgoing ball.

Slice selection follows the resolved shot side plus spin, including existing practice and custom-event controls. A slice serve remains a serve. During long rests the opponent finishes travel, holds ready, then split-steps before preparation. The animated outline remains 1.2 cm.

## Reproduce and adjust

In the lab, run `scripts/setup.ps1`, then `scripts/build.ps1 -Extract -Publish` through PowerShell. The latter checks subprocesses and validates before publication. Omit `-Extract` to reuse reviewed observations or `-Publish` to keep a candidate local. `-Blender` overrides the portable executable. Node utilities use the sibling frontend's installed dependencies.

Edit the metric poses in `scripts/motion_recipes.py` and the constraint solver in `scripts/build_motion_library.py`. Rebuild and compare source, preparation, contact, finish and grip before publishing. `output/tennis-motion-master.blend` has named editable NLA actions. Environments, weights, observations, sheets and masters stay in the lab. Manual Blender edits must be carried back into reproducible controls.

- `node scripts/review_server.mjs`: [frame/source review](http://127.0.0.1:4184).
- `node scripts/gameplay_server.mjs`: [eight-shot full-court sequence in the real frontend renderer](http://127.0.0.1:4185/review/gameplay.html). Lateral/depth/diagonal runs, both slices, drives, serve, both hands, pause, frame step and exact-contact controls.
- `node scripts/check_choreography.mjs`: inspect all actual exported frames for grip drift and abrupt racket rotation/translation; reject failures before publication.

## Verification and limits

The full frontend suite passed **196 tests / 21 files** and the production build passed. The existing large-renderer-chunk warning remains. glTF validation reports **zero errors and warnings**. Peak racket rotation per 60 fps frame is approximately 25 degrees forehand, 23 backhand and 32 serve; slices are below 5 degrees. The audit caught a 158-degree serve recovery flip and rejected it before final publication.

Tests load the actual rig and require all five contacts within 2 mm for both hands. They check sustained shoulder turn over several preparation phases, knuckle/bevel geometry, supporting backhand grip, both slice paths, continuous racket rotation, multi-metre travel facing five route directions, strides over 1.25 m, reachable feet, repeated/arbitrary seeks, speed limits, cadence/rest bounds, toss handoff and audio crossings. Rest tests preserve exact configured rest duration while allowing physically necessary cadence changes.

In-app browser checks at 1280×720/900 verified meaningful pages, no framework overlay, healthy console, normal-speed sequence, player-distance/close silhouettes, clip/source selection, exact-contact controls and real practice pause → next repetition → slower playback. Paused forehand, backhand and serve impact frames held `contactError=0.00000`. A narrower review layout was inspected and its footer made persistent. This is desktop/browser evidence, not phone-device or endurance certification.

Second-iteration review includes dense source sheets for the three original takes, additional bounded footwork/slice sampling, straight-front unit turns, serve/backhand grip close-ups and the full-court sequence at normal speed. The existing production Spin control selects `forehand-slice` in the real preview. Both slices and running are authored technique: January 690–750 s sampling did not establish a complete usable slice take. The lab's `docs/motion-revision-2.md` records these boundaries.

Older volley, half-volley, lob, approach, overhead and one-handed-backhand labels still use core-motion proxies. Exact individual style, phone hardware, Firefox/Safari, long-session performance and owner aesthetic approval are not certified by this desktop verification. No remote push or deployment is implied.

## Primary sources

- [MediaPipe Python](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/python).
- [GVHMR repository](https://github.com/zju3dv/GVHMR), [license](https://raw.githubusercontent.com/zju3dv/GVHMR/main/LICENSE), [installation](https://raw.githubusercontent.com/zju3dv/GVHMR/main/docs/INSTALL.md).
- [Quaternius animation library](https://quaternius.com/packs/universalanimationlibrary.html).
- [Three.js AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html) and [AnimationAction](https://threejs.org/docs/pages/AnimationAction.html).
# Reference-led correction pass (2026-09-05)

The owner's frame-by-frame review rejected the revision-2 choreography despite its contact/grip checks passing. Revision 3 is being developed in `F:\Codes\Tenmulate_motion_analysis`: visual authoring from the original local takes, paired front/rear reference panels, calibrated joint-space arm chains, deterministic anatomical envelopes, correct support-hand grip conventions, and ordinary running/walking cycles. Extracted pose observations are no longer production inputs. See the lab's `docs/motion-revision-3.md` for the correction ledger and evidence. Export validation must include the actual skeleton's joint rotations and torso clearance before runtime publication; visual review remains necessary.
