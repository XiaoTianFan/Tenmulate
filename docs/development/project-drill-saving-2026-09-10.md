# Project drill saving and editor recovery

> Current save behavior is defined by the [unified saving system](saving-system.md) and ADR-0053. The project-only workflow below is the earlier implementation record.

Date: 2026-09-10. Decision: [ADR-0043](../decisions/0043-project-drill-catalog-and-editor-drafts.md).

## User workflow

The previous **Save locally** action called `useAppData.saveDrill`, writing only
`tenmulate.appData.v2` in that browser. It did not modify project files. The new
**Save to project** action waits for an acknowledged atomic write to
`src/content/project-drills.json`, then updates the library. All 16 initial drills
are now editable project entries. `PLAYER_DRILLS` remains an immutable starter
collection for templates, migration and regression fixtures.

Choose **Edit drill** to change that entry directly, or **Make editable copy** for
a separately named starting point. Save selects an existing normalized name first,
then an existing ID. Names ignore case, surrounding/repeated whitespace and Unicode
compatibility differences. The overwritten entry retains its ID. Renaming an
existing entry onto another entry merges the two slots. Timeline length determines
the saved player-shot count. Create new drill starts an empty timeline; import
validates a JSON drill and saves it through the same project endpoint.

The left library sidebar is removed. Handedness and session overrides are in the
right inspector. Create and import stay in its bottom action area. Session rhythm
overrides affect a run; permanent changes are authored in the editor.

## Drafts and server boundary

Unsaved edits are separate from the project catalog. Per-drill snapshots in
`tenmulate.editorDrafts.v1` retain data, selection, temporary camera view, overview,
open inspector sections and scroll position. Writes are debounced; route changes
and page exit flush recovery. The mounted app also keeps snapshots in memory if
browser storage fails. Clearing browser storage removes recovery, not project saves.
Empty timelines and temporarily blank names are recoverable but cannot be saved
as valid project drills. Testing a drill and returning to the editor restores the
same draft. A clean saved snapshot refreshes from newer project data; an unfinished
draft remains intact. Preview components still unmount normally when leaving Editor.

Existing browser-only custom drills remain available as recovery entries until
superseded by a matching project entry. Original app-data storage is not rewritten
into the project automatically. Explicitly save such entries to promote them.
Saved **shot** presets keep their existing storage; this change concerns drills.

Both `npm run dev` and `npm run preview` expose the fixed-path
`/__tenmulate/project/drills` API on loopback. It validates the whole drill schema,
bounds request size, rejects foreign-origin writes and uses a per-server mutation
queue with catalog revision checks. A stale write is rejected; review the refreshed
library and save again. A disk/network failure leaves the draft intact and does not
claim success or fall back to a browser save. Malformed catalog files are not reset.
Production builds also include a snapshot of the project catalog for static/offline
playback. A static public host cannot write to this checkout. Rebuild to distribute
updated project drills in a new static bundle.

## Verification

All **546 tests / 50 files**, production build and active motion/cache guard pass.
The complete production browser workflow has **33 passing checks**.

The project-store and recovery tests cover actual temporary-file persistence,
reopening, two HTTP clients, name/ID overwrites, rename collisions, stale concurrent
writes, schema errors, damaged files, local-origin enforcement, deletion, browser
recovery, debounce/flush, quota failure and invalid/unfinished draft recovery.

Isolated Edge checks exercise the complete production UI against a temporary
catalog: direct edit, independent per-drill recovery, WASD camera changes, selection,
overview, expanded sections, reload, disk saves, fresh-browser reads, same-name
overwrites and identity changes, failed-save recovery, import and empty new drills.
Desktop (1680×1000), intermediate (1080×898) and mobile (390×844) screenshots were inspected. The library has
no redundant sidebar or horizontal page overflow; bottom actions remain reachable.
No uncaught browser errors occurred in the passing workflow. The empty-new-drill
check also caught and fixed a null camera access in the old editor fallback.

Evidence is in `C:/Users/20378/AppData/Local/Temp/tenmulate-project-drills-qa/`:
`browser.mjs`, `browser-results.json`, `production-extra.mjs`,
`production-extra-results.json`, library/editor screenshots, `tests.log` and
`build.log`. QA writes only its own temporary catalog. The actual project catalog
remains the initial 16 entries. The existing local preview on port 5173 was restarted
to load its project API; the user's browser tab and browser records were not changed.
This is local implementation and verification, not public deployment.
