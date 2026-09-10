# ADR-0043: Project drill catalog and separate editor recovery

- Status: Accepted for local implementation
- Date: 2026-09-10
- Scope: Drill library persistence and editor lifecycle; shot presets remain unchanged.

Explicit drill saves write `src/content/project-drills.json`. The library reads
this catalog through a loopback-only Vite API in both development and preview.
The catalog is also included in production builds as a read-only offline snapshot.
The programmatic `PLAYER_DRILLS` collection remains the starter/template and test
fixture source, rather than being reinserted into the editable library on startup.

Save validates the full player-first drill schema before replacing the catalog
atomically. A normalized matching title selects the existing slot first; otherwise
the drill ID selects the slot. The target retains its ID. Renaming an existing
drill onto another title merges those two entries. Names compare without case,
surrounding whitespace, repeated whitespace or Unicode compatibility differences.
Repetition count follows the authored timeline. Optimistic catalog revisions
reject stale writes and require a deliberate retry after refreshing the library.

The fixed-file API accepts only local, same-origin JSON mutations with the editor
request header. Request content cannot select filesystem paths. Failed saves
never fall back to browser storage or claim success. A static public deployment
does not gain project filesystem access; project editing requires the local server.

Unfinished edits have a distinct per-drill recovery cache, `tenmulate.editorDrafts.v1`.
It preserves the edited drill, selected shot/transition, temporary camera, overview,
and inspector state across route changes and reloads. Recovery is not publication.
The editor still unmounts when leaving it, releasing preview workers and its court
viewport. Existing browser-only custom drills remain recoverable and can be
explicitly saved into the project. Saved shot presets retain their existing storage.

The library has one list and one inspector. Every drill offers direct editing;
copying is optional. New drill and JSON import actions stay at the inspector bottom.
Handedness and run overrides remain in the inspector. A saved project catalog is
shared by browsers connected to this checkout and becomes part of the next build.
