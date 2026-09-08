# ADR-0032: Speed, acceleration and cadence based locomotion

- Status: Accepted for local implementation
- Date: 2026-09-08
- Extends: ADR-0029 (interval-first timing), ADR-0021 (prepared stroke entry)
- Supersedes: distance-gated automatic walk/run selection in ADR-0015/0029

## Problem

Quick Practice's 0.7–0.9 m side approaches could never run: the old selector
required both 1.1 m travel and 2.25 m/s peak speed. At the existing acceleration
ceiling those short routes played walking at 1.48–1.68 times its source speed.
Walking and running also used inconsistent stride/foot-plant assumptions while
their blend changed during acceleration. A separate planner error assigned the
preceding shot's movement preference to the incoming shot's approach.

## Decision

1. Keep shot interval primary and retain the bounded stroke/movement rate search.
   Use the previous shot's solved pace for recovery and the next shot's solved
   pace for approach, including direct routes. Schedule and playback share this
   planner, versioned `gameplay-rhythm-v7`.
2. Solve automatic gait weights from the leg's planned peak speed, acceleration
   and required walking cadence. Remove minimum-distance eligibility for jogging.
   The speed blend starts at 1.05 m/s and reaches running-clip weight 1 at 1.65 m/s;
   cadence demand can complete it earlier, at 1.425 m/s. Strong acceleration adds
   an earlier athletic bias. These are calibrations for the current clips, not
   universal human walk/run thresholds.
3. Preserve slow forward walking and short lateral adjustment. Use a shorter
   running stride, lower heel lift and longer stance for jogging; progressively
   restore full running form as speed increases. Automatic native clip-rate
   ceilings are 1.25× walk, 1.35× adjustment and 1.8× run, with a 2.4 m maximum
   cycle distance. Existing travel bounds remain 7.2 m/s and 12 m/s².
4. Solve weights and cycle distance for the entire leg. Pose sampling and foot IK
   use one distance phase, so cadence follows acceleration/braking without
   reclassifying the gait or resetting a planted foot each frame. Adjustment
   direction is selected in the initial body frame, mirrored by handedness.
5. Keep authored MotionLab clip overrides, crossovers, slides, rigid grips,
   fixed bone lengths and prepared-entry clocks. The active GLB and all motion
   manifests are unchanged. This is a runtime blend/footwork improvement; jogging
   uses the existing running clip and is not a newly captured motion asset.

## Verification and limits

354 tests across 37 files, production build and active-motion/cache guard pass.
Actual rig checks cover both hands, distance-clock seeking, contact anchors,
planted feet, limb lengths and all 16 bundled drills. The 2.5-second Rally fixture
keeps every requested interval and transitions into the prepared stroke exactly
at arrival. See the [verification receipt](../development/movement-selection-2026-09-08.md).

The default automatic solver is inexpensive closed-form arithmetic, with no new
per-frame optimizer, asset loading or history dependence. Explicit review clips
retain their authored behavior. Naturalness on the intended display remains an
owner-review matter; local numerical/visual verification is not public deployment.
