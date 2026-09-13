# ADR-0055: Independent trajectory and landing-zone visibility

- Status: Accepted
- Date: 2026-09-13
- Scope: Quick Practice, drill editor and rehearsal playback
- Refines: ADR-0051 presentation rules; pseudo-return line/trail suppression remains unchanged

## Context

The trajectory toggle also removed the opponent landing zone and its editing
interaction. Playback Settings implicitly enabled lines. The user clarified
that blue player targets must remain visible during playback and top-down
editing must always show trajectories.

## Decision

| Surface | Yellow opponent zone | Blue player target | Trajectories |
| --- | --- | --- | --- |
| Quick Practice setup / editor, player view | Visible | Visible | Toggle choice |
| Top-down editing | Visible | Visible | Always shown |
| Editor sequence preview | Visible | Visible | Toggle choice |
| Launched practice / drill | Hidden | Visible | Toggle choice |

Quick Practice pseudo-player-return lines and trails stay hidden in every view,
as specified by ADR-0051. The table governs the trajectories otherwise available
in each surface. The blue target follows the active player event or practice
repetition.

Top-down view temporarily overrides the trajectory choice and disables the
switch with an explanatory title. Returning to player view restores the stored
choice. Test drill inherits the editor's player-view choice. Playback Settings
offers an independent trajectory switch; opening Settings does not enable it.

Zone visibility is separate from its geometry and from line visibility. Hidden
opponent zones reject pointer/keyboard editing and stay hidden when a new
trajectory or zone arrives. Returning to configuration restores the latest zone.

## Verification

- 31 focused tests across landing-zone control, landing-zone geometry and
  rendering playback pass, including hidden-zone model updates and interaction.
- Production build and active motion/precache checks pass.
- Actual Edge checks cover setup and editor with trajectories off, top-down
  override and restoration, launched practice and Test drill, and playback
  Settings with the toggle off/on. Blue targets remain visible throughout;
  yellow zones remain hidden during launched playback.

This records local implementation and browser verification, not public
deployment or owner acceptance.
