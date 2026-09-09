# ADR-0037: Player-first drill planning

- Status: Accepted for local implementation
- Date: 2026-09-09
- Supersedes: ADR-0035 and ADR-0036's opponent-owned drill events; retains their physical flight, motion, manipulation and persistence contracts

## Decision

Schema 2 drills author the player's tactical actions. A separate opening feed or
serve starts each point. Each event owns a player camera, shot configuration,
opponent-side landing rectangle, and the opponent's response configuration and
player-side return rectangle. Forehand/backhand and crosscourt/line names refer
to the player. The event interval measures successive player contacts.

The camera anchors a racket-contact neighborhood in court coordinates; eye height
and look direction do not turn the camera into a ball emitter. A player's contact
must also lie on the incoming physical trajectory. Opponent contacts are resolved
on the player's flight using the shared motion/recovery planner. Unreachable
contacts are reported; no endpoint snaps, invisible replacement feeds or ball-time
warps are allowed. Position travel retains acceleration/deceleration and opponent
tracking, with the authored view restored for each player stroke.

The renderer may retain opponent contact records for mannequin animation, but
player event records own authoring, repetition counts, seeking, cues and metadata.
Opening shots do not count as player repetitions. New points and set rests are
explicit boundaries. An optional event opening feed preserves older sequences
that contained additional serves; it remains a launch phase before that action.

Schema 1 is an import/Quick Practice compatibility contract. Migration moves the
first incoming shot into the opening phase, maps each old pseudo-return into the
player action, and attaches the following incoming shot as the opponent response.
Camera and court coordinates retain their physical meaning. Old authored names
are identified as replies to the old shot rather than silently relabeled as the
player's original intention. Original local data is backed up before schema 2 is
persisted. Schema 2 JSON and saved presets validate strictly and round-trip without
inheritance from unrelated drills. Quick Practice retains its opponent-feed model.

## Implementation and verification plan

1. Add canonical player/response/launch contracts, strict validation, migration,
   and player-authored shot/drill presets. Test role/coordinate conversion and
   saved-data round trips before changing the editor.
2. Compile opening, player and response phases on a shared physical clock. Test
   contact continuity, deterministic variation, interval limits, camera travel,
   set boundaries and impossible combinations; retain shared mannequin planning.
3. Replace the editor's opponent event controls and timeline with player actions
   and a selectable opening phase. Preserve both-zone drag/resize, WASD gestures,
   sliders, preset updates, undo/redo, import/export and one mounted renderer.
4. Verify production desktop/mobile authoring and actual rendered playback,
   including opponent motion/contact after blending. Run the full test suite,
   build and motion guard, record limitations and commit focused stages.

Local implementation and verification are separate from owner acceptance and
public deployment. Evidence will be recorded in the development ledger.
