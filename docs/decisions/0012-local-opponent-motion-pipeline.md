# ADR-0012: Local opponent motion production

- **Date:** 2026-09-05
- **Status:** Accepted direction; implementation and visual acceptance tracked separately
- **Supersedes:** Cloud mocap and owner-delivered finished clips in the motion production plan; retains ADR-0005's neutral character and runtime boundaries.

## Decision

Build the motion laboratory in sibling `F:/Codes/Tenmulate_motion_analysis`. Do not put video processing, model environments, source footage, or experimental DCC workspaces in the frontend repository. Use the two owner-supplied local Djokovic practice videos to identify stable right-handed forehands, two-handed backhands, normal serves, and useful preparation/recovery reference. Do not upload them to a mocap service.

Keep the existing CC0 Quaternius carrier. A purchased skeleton or generated character is unnecessary. Following the owner's revision-3 review, visually author from the local front/rear references and fit calibrated anatomical joint DOFs; extracted monocular poses must not drive the production bake. MediaPipe extraction remains optional diagnostic work. Blender is the local authoring/baking/export tool. Use fixed segment lengths, elbow/knee hinges, separate forearm rotation and wrist flexion/deviation, rigid grip attachment and versioned exported-joint gates. The two recordings are independent references, not synchronized multiview capture.

The minimum continuous motion library is ready, split step, lateral adjustment in both directions, forward/backward movement, ordinary running and walking, forehand, two-handed backhand, normal serve, and recovery. Use authored connectors with common boundary poses; evaluate open clips only where they improve this set. Do not make account access, payment, SMPL body-model licensing, or a cloud service a pipeline prerequisite.

The owner's second iteration adds sustained unit turns, multi-metre direction-facing running, separate forehand/backhand groundstroke slices and stroke-specific grips. Continental serve/slices and backhand dominant hand, semi-western forehand and the supporting backhand grip must be expressed by the actual hand-to-handle geometry. Preserve the coil through preparation and unwind through the shot. Large travel strides settle into balance before the next stroke. Author slices transparently when bounded source review does not establish a complete suitable take. Acceptance includes actual exported geometry and normal-speed gameplay, not grip labels or angle metadata alone.

The third iteration requires paired, phase-aligned local source panels below the 3D view in both review tools; visible missing/secondary-view labels; anatomical diagnostics for all articulated joints; and correction of every stroke and movement clip before acceptance. Mechanical gates precede visual review and do not replace it. The supporting left eastern backhand grip uses mirrored bevel 7.

## Runtime contract

Export baked motions for the exact existing skeleton, a separate racket, and versioned metadata. Metadata records source ranges, processing provenance, units, root policy, duration, contact/toss/recovery markers, and playback bounds. The frontend owns court placement, deterministic session time, trajectories, camera, and ball flight. Production tools and inference are build-time only.

Evaluate motion at absolute session time so pause, scrubbing, slow motion, replay, and dropped frames keep the same pose/contact. Move the body root smoothly between authored contact locations and align planted feet during stance. Connect preparation, strike, and recovery with pose-compatible boundaries; blending alone does not repair foot sliding or hand grip. Place the racket string bed at the solver's launch point at contact. Show a serve toss before that handoff and preserve ball pace independently of animation rhythm.

## Delivery and evidence

1. Commit this direction before pipeline implementation.
2. Inventory and sparsely sample the source videos; record precise candidate ranges and rejection reasons.
3. Build reproducible visual reference inspection, constrained authoring, export, and anatomical validation utilities in the lab.
4. Integrate the resulting motion assets and controller in the frontend, preserving the existing load-failure behavior.
5. Verify forehand/backhand/serve, four movement directions, transitions, seeking, pause/replay, and contact timing numerically and in the player-camera render. Check a close review view for foot, grip, and deformation defects.

Local implementation does not imply owner biomechanics approval, target-device performance acceptance, or public deployment. Preserve source provenance without redistributing the source videos; public asset provenance review remains a release gate.
