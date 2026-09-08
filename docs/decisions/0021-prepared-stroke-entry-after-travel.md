# ADR-0021: Prepared stroke entry after travel

- Status: Accepted for local implementation
- Date: 2026-09-08
- Supersedes: Full-clip preparation after every arrival in ADR-0015/0017. Their
  mode-aware recovery, separate ball/stroke/movement clocks and source-rate scaling remain.

An opponent arriving sideways must continue into the stroke without briefly
returning to net-facing ready and replaying the unit turn. The motion laboratory
defines completed unit-turn boundaries for both drives, slices and volleys. Its
full, validated publication adds `preparedEntry` metadata to the unchanged GLB.
The frontend does not infer entry frames from elapsed movement or invent pose keys.

The compiler marks repetitions with a real incoming travel leg as prepared
approaches. The shared planner reserves the blend and remaining entry-to-contact
lead before assigning feasible contact times. It locks that decision into the
repetition for deterministic playback and seeking. `plannerVersion` advances to
`gameplay-rhythm-v4`.

During braking, the movement sampler blends toward the next stroke's static
prepared pose. Foot IK weight, travel lean and gaze correction fade with locomotion.
Waiting retains the prepared pose and the same contact-height envelope as stroke
entry. The swing samples `entryTime + elapsed * rate`; authored contact and finish
clocks remain intact. Short incoming legs reserve enough blend time. A reserved
turn in place also completes the blend instead of snapping at its endpoint.

Standalone strokes without incoming travel retain full preparation. Serves and
overhead proxies have no prepared-entry metadata and preserve existing playback.
Literal slide braking can use the same arrival contract, without changing automatic
hard-court movement selection. Practice, Editor and drills share this compiler/renderer.

Checks must reject the old ready entry, cover both hands and 50–150% rhythm,
preserve racket contact and deterministic seeks, and inspect the actual rig after
blending/IK. See the [verification receipt](../development/prepared-stroke-entry-2026-09-08.md).
