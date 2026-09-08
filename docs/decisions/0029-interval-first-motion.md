# ADR-0029: Interval-first motion timing and continuous arrival preparation

- Status: Accepted for local implementation
- Date: 2026-09-08
- Supersedes: Fixed stroke-rate priority in ADR-0017 and static prepared-pose holding in ADR-0021. Source-clock scaling, authored phase boundaries, recovery policies and camera continuity remain.

## Decision

Requested shot interval is the primary contact-to-contact control. Stroke rhythm
and movement pace are secondary preferences, each 50–300%. `solveShotInterval`
first retains those preferences when feasible, then searches bounded increases
before extending a contact interval. It samples 51 movement adjustments and bisects
the accompanying stroke adjustment, minimizing weighted squared log deviation from
the preferences. Movement adjustments cost less than stroke adjustments. The search
contains no trajectory fitting, asset loading, rig sampling or React updates.

`compileSession` and continuous-practice batch joins use that solver. Each resolved
stroke retains one uniform source-clock rate; physics samples and seed streams do
not change to satisfy motion cadence. Updating a preceding stroke's rate shrinks
its occupied window, preserving already scheduled contacts. The planner no longer
increases travel pace invisibly during playback. Its push-off/cruise/braking profile
retains zero endpoint velocity/acceleration, with product ceilings of 7.2 m/s and
12 m/s². These are calibration limits, not measured player abilities. Preferred
100% still uses 3.2 m/s and 4.4 m/s² before interval fitting.

Full practice recovery is preserved. Drill recovery/direct-route selection still
uses the shared planner. Camera travel and incoming-ball clearance remain constraints;
an interval that cannot fit at the ceilings reports the required longer duration.
Intentional set rests remain pauses. Return links must fit the chosen interval
within one 240 Hz physics tick; an unavailable link starts a new feed rather than
silently stretching the interval for a return arc. The bounded return search is
not an exhaustive proof about every possible human return.

For prepared drives, slices and volleys, the final approach now advances source time
up to the existing `preparedEntry` boundary during braking. The vertical/contact
envelope advances with it. Arrival ends exactly at stroke entry; the former 180 ms
prepared dwell is removed. Spare time goes into ready waiting before the approach.
Serve-and-volley departs immediately and uses the available approach duration.
Slides and turns in place use the same continuously advancing entry contract.
Source GLB, phase metadata, rigid grips, bone lengths and contact anchors are unchanged.

Planner version is `gameplay-rhythm-v6`. Repetitions expose requested/actual outgoing
interval and a limited flag. Practice and Editor show resolved rates beside the
secondary controls; playback shows current resolved values and only reports extra
time when that transition requires it. Legacy percentages remain valid, and import
validation/storage accept the expanded range.

See the [implementation and verification receipt](../development/interval-first-motion-2026-09-08.md).
