# ADR-0039: Direct court editing and varied rally contacts

- Status: Accepted for local implementation
- Date: 2026-09-09
- Extends ADR-0037 and ADR-0038; supersedes their editor history/import toolbar and Quick Rally independent-feed behavior.

## Decision

Selecting an opening or player event always edits that timeline selection.
Opening camera gestures edit the receiving player's camera, which also anchors
that player's first contact. Wheel, drag-look and WASD work in both selections.
A separate button beside the opening chips plays the whole sequence once;
stopping, finishing or selecting another item restores its authored view.
Top-down is a temporary inspection camera and never overwrites a shot camera.

The editor retains a two-choice player-hand control but removes undo/redo and
import/export actions. Timeline length determines the saved drill's default shot
count. The panel is named Drill configuration. Existing stored data remains readable.

Opening opponent positions and Quick Practice initial positions are edited by
dragging the mannequin in the shared rendered court. A ready pose stays at the
authored body root during top-down placement. A court-plane hit volume captures
the pointer, previews the model directly and publishes one change on release;
cancel restores its previous position. The model, camera and zones share one
mounted renderer. Ordinary drill opponent contacts remain computed from the ball.

Quick Rally gains an independent player return shot, spin, speed and blue landing
zone. Other Quick Practice categories remain independent feeds. Each pseudo-hit
starts on the actual incoming flight; its physical bounce and subsequent legal
intercept determine the next opponent contact and recovery route. Preview batches
carry the preceding physical flight across their boundary rather than inserting
a fresh feed. Finite launched practice still respects work blocks and rests.
Settings and the first future preview batch are solved in a cancellable worker.

Both the player-first drill planner and the Quick Rally connector use the shared
bounce-contact preference. A separate seeded draw requests rising (25%), apex
(20%) or early descending (55%) contact. These are preferences over the simulated
first-bounce path, constrained by family, legal height, motion feasibility and
requested interval. Feasible timing is reported; those percentages do not promise
an exact distribution when the ball or movement rules exclude a phase. Volleys
and overheads retain their airborne contact rules. No flight is time-scaled or
snapped to a new emitter. Impossible connections stop and report the configuration
issue rather than manufacturing an unrelated return.

Opponent hands, source clip clocks, rigid grips, bone lengths and contact anchors
are preserved. No motion asset or production-lab artifact changes.

## Verification

See the implementation receipt for focused physics/seam tests, rendered camera,
placement and playback checks, and final test/build evidence. Local implementation
and browser verification do not imply owner acceptance or public deployment.
