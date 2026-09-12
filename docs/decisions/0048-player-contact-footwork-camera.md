# ADR-0048: Resolve player camera footwork at physical contact

- Status: Accepted for local implementation
- Date: 2026-09-12
- Supersedes: The exact authored position endpoint in ADR-0037, ADR-0041 and ADR-0042. Their continuous physical ball, authored direction, staged attention and bounded movement contracts remain.

## Problem

An isolated player-shot preview emits from a nominal racket anchor, .45 m on
the stroke side and .65 m in front of the authored camera. Gameplay must hit
the incoming physical ball. Its 1.4 m reach disk also included contacts on the
other side of the body and behind the camera. Restoring the exact authored
camera could therefore make a forehand emerge from the left of the screen.

The owner's Crosscourt Rhythm shot 3 reproduced this with the correct authored
13.53-degree yaw: its real contact was .52 m behind the eyes and .25 m across
the body. The nominal preview could not expose the discrepancy.

## Decision

Treat the authored camera position as the intended contact neighborhood. Resolve
the actual stance by translating its horizontal court position by the difference
between the physical incoming contact and the nominal racket anchor. Preserve
authored yaw, pitch, eye height and the session-wide FOV. Preserve the original
saved event separately from `CompiledPlayerEvent.contactCamera`.

The camera planner uses those resolved endpoints during candidate feasibility
checking and for both recovery and reception, including custom routes and point
resets. Correction remains inside the existing 1.4 m contact envelope. It is
planned footwork with the existing speed/acceleration/settling bounds, never a
per-frame snap. The opening starts from its resolved ready position. Contacts,
bounce phase, landing zones and aerodynamic time remain physical; a different
candidate may be selected if the resolved camera route is otherwise infeasible.

Isolated editing remains independent of earlier invalid links and continues to
show nominal contact. Label it as estimated and provide **Preview actual shot**
using the already compiled sequence, including incoming reception and outgoing
release. Do not silently write resolved camera positions into saved content.

At full camera motion intensity, the ball is .65 m ahead and .45 m on the
configured racket side at contact. Extreme authored gaze/FOV still controls
visibility; there is no forced screen-corner emitter. Reduced camera motion
retains its deliberate scaling and does not guarantee contact-relative framing.

This change applies to player-first drills. Quick Practice, motion assets and
ball physics are unchanged. Planner version: `gameplay-player-drills-v17`.

See the [investigation and verification](../development/player-contact-camera-2026-09-12.md).
