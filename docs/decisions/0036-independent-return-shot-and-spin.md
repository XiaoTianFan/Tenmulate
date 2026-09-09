# ADR-0036: Independent incoming and return shot styles

- Status: Accepted for local implementation
- Date: 2026-09-09
- Extends: ADR-0035 court-space return zones
- Supersedes: Implicit return style selection and spin-free volley behavior

## Decision

`DrillEventV1.returnShot` stores `{ type, spin, spinRateRpm? }`, independently of
the event's incoming shot. Return types are groundstroke, drop shot, volley,
overhead and lob. Spin choices are topspin, flat and slice. The event's existing
positive-z `returnLandingZone` remains the sampled first-bounce intention.
Moving/resizing either zone does not reset shot configuration. New/update saved
presets and JSON exchange retain the complete return configuration.

The returned flight starts at a legal sample on the incoming trajectory. Ground
and drop shots use post-bounce contacts; volleys use pre-bounce contacts at
0.65–1.75 m; overheads use pre-bounce contacts at 1.8–2.65 m. A serve cannot be
volleyed. Return style owns its preferred pace, contact height, spin and clearance;
incoming pace or the next opponent stroke does not silently replace an explicit
choice. A bounded two-contact/three-pace search uses the existing aerodynamic and
bounce simulation. It holds the sampled return target fixed, and the shared
interval/recovery planner checks each physical next contact before linking it.
Infeasible style/path/interval combinations remain explicit new feeds.

Old events without `returnShot` retain a topspin groundstroke return, or a lob
before a following overhead. Saving a preset materializes that inherited choice.
New editor insertions have an explicit groundstroke return. Existing documents
remain schema version 1; new fields are optional and strictly validated.

Kick and sidespin are serve-only selections. Legacy non-serve kick normalizes to
topspin; legacy sidespin normalizes to slice, both in compilation and saved preset
snapshots. The trajectory entry point enforces the same mapping. Volley spin now
participates in Magnus and bounce calculations, with flat defaulting to zero rpm.
Drop shot is a separate incoming family/profile and default library entry, with a
short landing, slower pace and slice default. It retains the existing appropriate
ground/slice animation; no new motion asset or source clock is introduced.

The right panel separates **Opponent shot** (type/spin/hand/stroke), **Return zone**
(return type/spin/rate), **Ball & rhythm** (incoming flight/timing), and Perspective.
Quick Practice likewise places shot/spin type in Opponent shot; Serve rhythm stays
in Ball & rhythm with Normal/Compact choices. Held zone gestures still update
scene meshes and commit compilation only on release.

Runtime identities: `ball-v8-shot-spin`, `gameplay-return-shots-v10`, content
`2026.09.09`. See the [verification receipt](../development/return-shot-controls-2026-09-09.md)
for numerical, persistence and actual rendered evidence.
