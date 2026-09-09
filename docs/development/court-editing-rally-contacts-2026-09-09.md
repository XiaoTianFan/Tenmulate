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
  scene independently of the shot-library list height. Wheel zoom adjusts the
  temporary overview without modifying the saved player perspective.
- Quick Rally saves a player return type, spin, speed, spin rate and blue landing
  zone. Actual incoming and outgoing contact coordinates are continuous. The next
  opponent location and recovery route follow that physical ball. Fresh preview
  batches carry the preceding return across the seam. Other categories retain
  independent feeds; finite practice retains its configured sets and rests.
- Both Quick Rally and player-first drills use the shared deterministic bounce
  contact preference, with early descent most common when feasible. Volleys and
  overheads retain airborne contacts. Infeasible links report their configuration
  issue. Worker preparation keeps expensive trajectory work off pointer gestures.

## Verification

The cumulative suite passed **456 tests across 45 files**. A subsequent focused
recheck passed all 15 Quick Rally and zone-control tests after the final overview
and interval-label refinements. `npm run build` passed TypeScript, production
bundling and the active 25-clip asset/cache guard. The existing large Three.js
bundle warning remains; no extra opponent asset is precached.

34 production-browser checks cover opening and player camera zoom/look/WASD,
camera persistence, direct opponent placement without per-pointer recompilation,
both Quick Rally zones, return-zone corner resizing, temporary overview zoom,
hand selection, timeline count, worker preparation, and one retained renderer
across routes. Live Quick Rally crosses its six-feed preview batch with a visible
pseudo-return. Whole-sequence playback starts from the opening regardless of
selection, completes once and restores the selected shot camera.

Desktop widths of 1080 and 1680 pixels and a 390-pixel mobile viewport were
checked. The annotated 1080-pixel layout now keeps the court bounded instead of
stretching it to the shot-library content height. Saved camera, position and return
configuration changes were read back from isolated browser storage. Neither
browser script reported a page exception.

120 rendered approach/entry/contact frames cover both opponent hands in Quick
Rally and player-first drills. Maximum measured socket/contact error was below
0.001 mm; bone-length deviation below 0.001 mm. Minimum sampled pelvis and knee
heights remained 0.600 m and 0.212 m. These are bounded rendered checks, not an
exhaustive motion capture or device-performance qualification.

Browser verification uses isolated Edge contexts because the frontend-testing
skill's browser plugin is not available in this session. The owner's existing
browser tab and storage are not reloaded or modified by these checks. Artifacts
are outside the repository under
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/court-editing/`:
`ui-results.json`, `playback-results.json`, `rig-results.json`, their three `.mjs`
scripts, and desktop/mobile/top-down screenshots. Feature implementation was
committed locally as `810ca75`; the follow-up stage records final UX refinements
and this verification receipt.

No motion assets changed. Local verification is separate from owner acceptance
and public deployment; no remote push or deployment is performed.
