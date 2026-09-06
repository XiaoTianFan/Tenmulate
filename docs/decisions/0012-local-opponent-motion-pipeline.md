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

The fourth iteration follows the owner's 14 annotated phase images and UCLA frontal regions near 13:40, 13:42 and 28:02. Author pelvis/chest pitch, side bend and head gaze as well as yaw. Use explicit joint curves where fitting trades away the visible elbow or racket path. Store a monotone per-stroke rhythm curve against reviewed source phases, bake it into the clip, and retain one uniform gameplay playback rate. Add upper-arm torso clearance and exported-pose checks for takeback, staggered backhand contact, folded finishes and the serve drop. Independent joint envelopes alone do not establish correct technique.

The fifth iteration follows 11 further annotated images. Hold the forehand's side-facing preparation through takeback before the low rearward lag. Preserve a delayed side-facing backhand drop and carry the finish across the body beside the opposite shoulder with both hands attached. Keep the serve racket forward during setup/toss, the chest sideways and legs extended in the baseline-facing drop, and continue pronation through extension before unwinding. Use denser 120 Hz solving/baking and 240 Hz interpolation checks to preserve the fast two-hand grip, without relaxing anatomical or continuity limits. Add racket/head clearance and annotation-time checks, retain rejection evidence against the prior library, and verify both hands after actual gameplay blending/IK. Source phase anchors and the uniform runtime speed factor remain authoritative.

The sixth iteration follows six further annotated images and the owner's carry/rhythm review. Lift the preparation elbows, extend the forehand into a deep pronated baseline-facing takeback and horizontal closed load, and widen the high backhand preparation into a continuous drop. Pace actual racket travel from the backswing into contact and decelerate through follow-through; preserve contact and clip duration while intermediate named phases follow their poses along the paced curve. Show measured racket speed in MotionLab. Raise the tossing shoulder and retain a downward racket during the toss before trophy lift. Use one two-hand belly/chest-level athletic carry across ready, split and travel, with forward hip/trunk lean and gait-synchronized sway. Validate these transforms and physical speeds independently, retain prior-library rejection evidence, and keep the anatomical and continuity budgets unchanged.

## Runtime contract

The subsequent volley addition uses the owner's UCLA frontal regions near 22:48 and 22:39. Author separate continental forehand and backhand volleys with a compact high preparation, forward step, short punch and shared ready recovery. Backhand preparation is supported at the throat, with one-handed impact. Select volley family before legacy spin labels, retaining explicit/inferred side, handedness, complete strokes and reachable travel. Preserve the prior corrected library and uniform runtime rate. Independently check volley geometry and reject the old slice proxies; validate both sides after actual gameplay blending/IK. Missing rear views remain labeled rather than replaced with unrelated shots.

Export baked motions for the exact existing skeleton, a separate racket, and versioned metadata. Metadata records source ranges, processing provenance, units, root policy, duration, contact/toss/recovery markers, and playback bounds. The frontend owns court placement, deterministic session time, trajectories, camera, and ball flight. Production tools and inference are build-time only.

Evaluate motion at absolute session time so pause, scrubbing, slow motion, replay, and dropped frames keep the same pose/contact. Move the body root smoothly between authored contact locations and align planted feet during stance. Connect preparation, strike, and recovery with pose-compatible boundaries; blending alone does not repair foot sliding or hand grip. Place the racket string bed at the solver's launch point at contact. Show a serve toss before that handoff and preserve ball pace independently of animation rhythm.

## Delivery and evidence

1. Commit this direction before pipeline implementation.
2. Inventory and sparsely sample the source videos; record precise candidate ranges and rejection reasons.
3. Build reproducible visual reference inspection, constrained authoring, export, and anatomical validation utilities in the lab.
4. Integrate the resulting motion assets and controller in the frontend, preserving the existing load-failure behavior.
5. Verify forehand/backhand/serve, four movement directions, transitions, seeking, pause/replay, and contact timing numerically and in the player-camera render. Check a close review view for foot, grip, and deformation defects.

Local implementation does not imply owner biomechanics approval, target-device performance acceptance, or public deployment. Preserve source provenance without redistributing the source videos; public asset provenance review remains a release gate.
