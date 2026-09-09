# ADR-0038: Player handedness and court mirroring

- Status: Accepted for local implementation
- Date: 2026-09-09
- Extends: ADR-0037's player-owned drill contract

## Decision

A shared Right-handed/Left-handed choice adapts drill layouts about the court's
longitudinal centerline. Right-handed is the default. Shot names, identifiers,
forehand/backhand meaning, cues and ball settings retain their authored meaning.
The opponent keeps their configured hand, as explicitly requested by the owner.

Reflection negates world x and camera yaw; a rectangle's x bounds become
`[-maxX, -minX]`. Camera depth, eye height, pitch, field of view and all z bounds
are retained. The opening's body position and yellow zone, every blue player zone,
every yellow response zone and all additional point openings reflect together.
This transforms court data, not the rendered venue or canvas.

Schema 2 drills and saved shots have an optional `playerHand` field recording the
orientation of their stored coordinates. Its absence means the existing right-hand
layout. Selecting the same orientation does not reflect again. Saved shots adapt
from their own orientation when inserted, including after overwrite/import/reload.
Player hand is drill-wide; applying the selection replaces older per-shot player
hand overrides. Opponent-hand controls remain independently editable.

`drillPlayerHand` persists the shared browser preference independently of Quick
Practice settings. Selecting a library hand does not rewrite bundled or saved
source records. Editor switching is one undoable operation, including any current
camera draft. Saving records the actual selected geometry and its orientation.

Seeded landing draws reflect their horizontal quantile as well as their rectangle,
retaining uniform coverage and corresponding target samples. The planner solves
the transformed geometry with the opponent's original hand. That hand's racket
offset and serve spin may produce different physical contacts and timings; source
clocks, legal contacts and motion feasibility still govern playback. The system
does not promise identical frame times between opposite player hands.

## Verification and limits

Require inverse/idempotence tests, arbitrary camera-heading checks, role/hand
preservation, strict JSON/storage round trips and full left-handed bundled drills.
Inspect desktop/mobile controls, both-zone placement and actual rendered opponent
contacts after blending. Custom combinations retain ADR-0037's reachability checks.
Local verification, owner acceptance and deployment remain distinct states.
