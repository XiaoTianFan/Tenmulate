# Project shot presets

> Current save behavior is defined by the [unified saving system](saving-system.md) and ADR-0053. The project-only workflow below is the earlier implementation record.

The editor's shot library is stored in `src/content/project-shots.json`. It starts
with the 21 system defaults; they are editable entries, not a separate read-only
list. Explicit saves write this file through the local development or preview
server. The next production build includes the updated catalog for offline use.

## Save or update

**Add New Shot** is fixed at the bottom of the left library, outside its scrolling
rows. Enter a unique preset name, choose shot type and stroke side, then select
**Create shot**. It starts from fresh family defaults in the current player hand,
including both balls, zones and a contact view; it does not copy the selected
timeline event or add an event automatically. Click or drag the resulting library
entry onto a timeline to customize it. Duplicate names are blocked in this flow.

1. Select a player shot in the timeline and edit its settings.
2. Choose **Update existing saved shot**. The dialog selects the associated preset
   when known, and lets you choose any other library shot, including a default.
3. Choose **Overwrite project shot**. The library updates after the file is saved.
4. Add that preset to any timeline to use its latest settings.

**Save new shot** creates a project preset. If its name already exists, the dialog
shows the replacement and the save updates that named slot. An explicit overwrite
retains the chosen slot's identity; renaming it onto another slot's name requires
choosing that other slot instead.

Presets include player and opponent balls, both zones, contact timing, rhythm,
movement pace, contact camera, camera transitions and opponent settings. Player
handedness is recorded so reuse mirrors the shot exactly once. Existing events in
saved drills are independent snapshots: changing a preset does not silently rewrite
their authored settings. Saving a shot and saving the containing drill are separate
actions.

## Delete from the library

Right-click a library row and choose **Delete shot from library**. The three-dot
button offers the same menu on touch screens; a focused row also supports
Shift+F10. This removes the project preset, including system defaults, through the
atomic project API. Matching browser copies (same ID or normalized name) are
removed from the current browser too, so an old alias cannot reappear on reload.
Existing drill events are independent snapshots and retain their settings.

The menu closes on Escape, outside interaction or actual row movement. A failed
delete keeps the row and shows the error for retry. Project operations require
the local server; browser-only presets can still be removed locally.

## Persistence and recovery

The project endpoint is `/__tenmulate/project/shots`, available through both `npm
run dev` and `npm run preview`. The local server is required to write the file;
static/offline copies use the packaged snapshot and explain that saving is
unavailable. No save silently falls back to browser storage.

Older browser-only shots remain available unless superseded by a project entry
with the same ID or normalized name. Updating one explicitly promotes it into the
project. Browser recovery records are not automatically published. A stale revision
refreshes the catalog and asks for a retry while keeping the modal's settings.

The shared project store validates all settings and performs atomic file
replacement. Fixed paths, same-origin loopback requests and optimistic revisions
retain the project drill save contract. Tests use temporary catalogs; actual
project and browser data are not overwritten by QA.

See [ADR-0045](../decisions/0045-project-shot-catalog.md), the
[implementation ledger](implementation-status.md) and
[rendered verification ledger](visual-verification.md).
