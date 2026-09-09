# Court editing and rally contacts — 2026-09-09

Implementation follows [ADR-0039](../decisions/0039-direct-court-editing-and-rally-contacts.md).

## Result

- Opening and player-event camera gestures edit the receiving player's authored
  view. Selecting a timeline event exits sequence playback. The preview button
  sits beside the opening chips below the canvas, plays once, and restores the
  selected view on stop or completion.
- The editor retains Right-handed/Left-handed selection, removes history and
  import/export buttons, renames Drill configuration and derives saved shot count
  from timeline length. Saved-shot creation/overwrite remain available.
- The temporary top-down court exposes both zones and directly draggable opening
  or Quick Practice opponent models. The model previews immediately; a release
  commits its body position once. The editor's narrow desktop layout bounds the
  scene independently of the shot-library list height.
- Quick Rally saves a player return type, spin, speed, spin rate and blue landing
  zone. Actual incoming and outgoing contact coordinates are continuous. The next
  opponent location and recovery route follow that physical ball. Fresh preview
  batches carry the preceding return across the seam. Other categories retain
  independent feeds; finite practice retains its configured sets and rests.
- Both Quick Rally and player-first drills use the shared deterministic bounce
  contact preference, with early descent most common when feasible. Volleys and
  overheads retain airborne contacts. Infeasible links report their configuration
  issue. Worker preparation keeps expensive trajectory work off pointer gestures.

## Verification in progress

The main implementation passed 453 tests across 45 files. Additional focused
coverage for actual drill contact-phase variety, serve-led rallies and saved
return settings passed (62 tests across 3 files). Production build and the active
25-clip bundle guard passed. Rendered checks cover both opponent hands in Quick
Rally and player-first drills, with rigid bone lengths and physical contact anchors.

Browser verification uses isolated Edge contexts because the frontend-testing
skill's browser plugin is not available in this session. The owner's existing
browser tab and storage are not reloaded or modified by these checks. Artifacts
are outside the repository under the task's `court-editing` visualization folder.
The final UI receipt and cumulative test count will be recorded after those checks.

No motion assets changed. Local verification is separate from owner acceptance
and public deployment; no remote push or deployment is performed.
