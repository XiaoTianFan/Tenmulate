# ADR-0022: Continuous drill camera, return space and reusable shots

- Status: Accepted for local implementation
- Date: 2026-09-08
- Supersedes: ADR-0015's per-shot scripted camera/expanding receiver coverage in drills

## Context

Per-shot camera scripts restarted from the launch view. React's repetition update
and the renderer's contact clock could disagree for a frame, producing a reset
before the next script. The editor saved drills but only a subset of shot settings.
Automatic returns could begin several meters away from the viewer.

## Decision

Compile a single absolute camera timeline with the opponent and ball schedule.
Hold the configured view during each incoming shot. After the return contact (or
the incoming flight's end when unreachable), move to the next view using a quintic
position curve with zero endpoint velocity/acceleration and bounded peak pace.
Track the rendered opponent during travel and blend back to the authored shot
direction before stroke preparation. Extend the contact interval when travel needs
more time. Seeking samples this timeline directly; no stateful catch-up filter.

Legacy camera destinations become shot views. Unscripted shots keep the previous
view. Reduced-motion intensity scales all shot views relative to the launch view;
zero intensity is stationary. The shared mounted renderer remains the owner.

Drills define a camera-relative return rectangle in meters: forward center distance,
width and depth. Near edges stop at 5 cm in front of the viewer. An automatic return
must begin on an actual incoming sample inside that rectangle and at a legal contact
height. It must still solve to the next racket contact under the existing flight
constraints. Impossible links remain explicit new feeds. Quick Practice retains
its existing coverage behavior. This is a virtual-space calibration, not body tracking.

Optional schema-v1 event fields capture camera view, stroke/hand, spin rate, bounce,
trajectory fitting, interval and independent motion/movement rhythm, alongside the
existing opponent position, landing zone, pace, variation, serve rhythm and cue.
Saved shots are validated local snapshots copied into events with fresh ids; editing
a saved shot never changes drills that already use it. Exported drills are self-contained.

## Verification

Numerical tests cover camera continuity, peak speed/acceleration, opponent tracking,
shot holds, shortest-angle interpolation, deterministic seeking, reduced motion,
return-space membership, exact incoming/return handoffs and document validation.
Editor persistence and actual rendered playback require browser verification before
claiming the complete user-facing change verified. Device and owner acceptance remain
separate from local implementation; this ADR authorizes no deployment.
