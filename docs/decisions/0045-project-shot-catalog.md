# ADR-0045: Editable project shot catalog

- Status: Accepted for local implementation
- Date: 2026-09-10
- Supersedes: Browser-only shot persistence in ADR-0022 and ADR-0035, and the
  unchanged-shot-storage exception in ADR-0043. Drill persistence remains in force.

`src/content/project-shots.json` owns the editor's reusable shot library, including
the 21 initial system defaults. A loopback-only development/preview endpoint reads
and atomically writes this fixed file using the same validation, revision and
request guards as project drill saves. The built app includes a read-only snapshot
for offline playback. Failed writes never fall back to browser storage.

An explicit overwrite selects any library slot and preserves that slot's ID.
Renaming onto another slot's name is rejected rather than replacing the wrong
shot. A new save with a normalized existing name replaces that named slot. The
persisted event records the canonical preset ID, complete ball/return settings,
zones, contact camera, camera transition, contact timing, rhythm and opponent
settings. Stored player handedness makes reuse mirror exactly once.

The update dialog and shot list consume the same catalog. Timeline insertion uses
its latest snapshot instead of the immutable `PLAYER_SHOTS` factory. That factory
remains a starter/test-fixture source; it is not reinserted into an edited catalog.
Existing drill events are authored snapshots and are not silently rewritten when a
reusable preset changes. The current event retains the saved preset identity.

Unmatched browser-only presets remain visible for recovery and can be explicitly
saved into the project. Project entries take precedence by ID or normalized name.
No automatic migration writes old browser data into the project. Draft recovery
remains separate from explicit saves. All new/update actions await the project
acknowledgment; errors preserve the modal and current editing state.
