# Local opponent motion pipeline

- **Updated:** 2026-09-05
- **State:** Research and source selection in progress; no motion acceptance claimed
- **Authority:** [ADR-0012](../decisions/0012-local-opponent-motion-pipeline.md)
- **Laboratory:** `F:/Codes/Tenmulate_motion_analysis` (separate from the frontend)

## Available material

| Local source | Duration | Picture | Intended review |
| --- | --- | --- | --- |
| `Novak Djokovic Practice January 2025.mp4` | 16:29.495 | 1920 x 1080, 60000/1001 fps | Stable strokes, approach and recovery |
| `Novak Djokovic Court Level Practice at UCLA.mp4` | 37:55.416 | 1920 x 1080, 60 fps | Complementary court-level stroke/serve reference |

Both files live in `C:/Users/20378/Downloads/Video`. Sparse contact sheets precede short detailed inspection; the full recordings do not need inference. Source video remains local and outside Git. Candidate times will be recorded after visual inspection, not inferred from filenames.

## Initial research decision

Reuse the 65-joint CC0 Quaternius neutral model. Test MediaPipe Pose Landmarker locally for image and hip-relative 3D observations; retain confidence and crop/time transforms. Its output is evidence for cleanup, not ground-truth court translation or racket tracking. Use the available portable Blender 5.2.1 for reproducible target-rig animation masters and baked exports. Author the small tennis connector set and explicit racket/foot constraints. This gives control without making a research body-model download or online account necessary.

Compare heavier local reconstruction only if selected footage exposes an unresolved problem worth its installation and model-license cost. General open animations can supply locomotion references, but do not establish Djokovic-specific stroke fidelity. A stable first sequence requires fewer carefully corrected strokes and compatible connectors, not a large unreviewed clip library.

## Verification plan

Review ready -> split -> right movement -> forehand -> recovery -> left movement -> backhand -> recovery -> forward/backward adjustment -> serve -> recovery. Check root continuity, planted feet, two-handed grip, serve toss, racket/ball contact, and normal-speed silhouette from the player camera. Absolute-time playback must agree under seek, pause, slow motion, and replay. Keep supported motions and unresolved defects explicit.

## Primary research sources

- [MediaPipe Pose Landmarker Python](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/python): local inference, video timestamps, landmark output and confidence.
- [GVHMR author repository](https://github.com/zju3dv/GVHMR): world-grounded reconstruction option to evaluate against setup and body-model dependencies.
- [Quaternius Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html): compatible general-motion candidate.
- [Blender glTF export](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html): baked skeletal animation delivery.
