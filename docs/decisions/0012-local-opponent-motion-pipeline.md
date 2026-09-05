# ADR-0012: Local opponent motion production

- **Date:** 2026-09-05
- **Status:** Accepted direction; implementation and visual acceptance tracked separately
- **Supersedes:** Cloud mocap and owner-delivered finished clips in the motion production plan; retains ADR-0005's neutral character and runtime boundaries.

## Decision

Build the motion laboratory in sibling `F:/Codes/Tenmulate_motion_analysis`. Do not put video processing, model environments, source footage, or experimental DCC workspaces in the frontend repository. Use the two owner-supplied local Djokovic practice videos to identify stable right-handed forehands, two-handed backhands, normal serves, and useful preparation/recovery reference. Do not upload them to a mocap service.

Keep the existing CC0 Quaternius carrier. A purchased skeleton or generated character is unnecessary. Evaluate local MediaPipe landmarks for bounded source clips, preserve raw observations and confidence, and combine useful measurements with editable, constraint-corrected animation. Blender is the local authoring/baking/export tool. Label inferred, extracted, and authored data honestly; single-camera depth, hidden limbs, racket orientation, and foot contact require correction. The two recordings are independent references, not synchronized multiview capture.

The minimum continuous motion library is ready, split step, lateral adjustment in both directions, forward/backward movement, forehand, two-handed backhand, normal serve, and recovery. Use authored connectors with common boundary poses; evaluate open clips only where they improve this set. Do not make account access, payment, SMPL body-model licensing, or a cloud service a pipeline prerequisite.

## Runtime contract

Export baked motions for the exact existing skeleton, a separate racket, and versioned metadata. Metadata records source ranges, processing provenance, units, root policy, duration, contact/toss/recovery markers, and playback bounds. The frontend owns court placement, deterministic session time, trajectories, camera, and ball flight. Production tools and inference are build-time only.

Evaluate motion at absolute session time so pause, scrubbing, slow motion, replay, and dropped frames keep the same pose/contact. Move the body root smoothly between authored contact locations and align planted feet during stance. Connect preparation, strike, and recovery with pose-compatible boundaries; blending alone does not repair foot sliding or hand grip. Place the racket string bed at the solver's launch point at contact. Show a serve toss before that handoff and preserve ball pace independently of animation rhythm.

## Delivery and evidence

1. Commit this direction before pipeline implementation.
2. Inventory and sparsely sample the source videos; record precise candidate ranges and rejection reasons.
3. Build reproducible local extraction, cleanup, authoring, export, and validation utilities in the lab.
4. Integrate the resulting motion assets and controller in the frontend, preserving the existing load-failure behavior.
5. Verify forehand/backhand/serve, four movement directions, transitions, seeking, pause/replay, and contact timing numerically and in the player-camera render. Check a close review view for foot, grip, and deformation defects.

Local implementation does not imply owner biomechanics approval, target-device performance acceptance, or public deployment. Preserve source provenance without redistributing the source videos; public asset provenance review remains a release gate.
