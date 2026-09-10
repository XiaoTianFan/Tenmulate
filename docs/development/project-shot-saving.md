# Project shot presets

The editor's shot library is stored in `src/content/project-shots.json`. It starts
with the 21 system defaults; they are editable entries, not a separate read-only
list. Explicit saves write this file through the local development or preview
server. The next production build includes the updated catalog for offline use.

## Save or update

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
