# ADR-0053: One save flow with development-only project destinations

- Status: Accepted for local implementation
- Date: 2026-09-12
- Supersedes: Project-only saves in ADR-0043 and ADR-0045, project-first browser merging, production-preview project writes, and implicit durable Quick Practice form saving. Existing catalog validation, stable identities and independent editor recovery remain.

## Decision

Every explicit content save uses `useSaveSystem`: Save drill (including import),
Save shot (new or replacement), Save config, and Save preset (new or right-click
replacement). Buttons describe the object, not its storage destination.

Vite's development build flag controls the destination policy. Development opens
a shared modal offering **This browser** and **Project default** every time.
Project capability determines whether that option is enabled; it does not decide
whether this is production. Production goes directly to browser storage and makes
no project API probes or mutations. Vite production preview has no project API
middleware, even on localhost. Development APIs retain loopback, same-origin,
request-header and revision checks.

Browser means durable `localStorage`, scoped to the browser profile and origin,
not tab-lifetime `sessionStorage`. Browser drill and shot versions override
same-ID or same-name project defaults. They are not published. Project promotion
clears the corresponding local override so the newly saved default is visible.
If clearing that override fails after the project write succeeds, the error
explicitly distinguishes those outcomes; neither destination is a silent fallback.

Quick Practice has one saved config per mode: Rally, Return, Volley and Overhead.
It includes camera, both landing zones, incoming ball, rhythm, environment,
quality, display calibration, highlight and seed. The form remains live across
route changes, but **Save config** explicitly persists it. Saving another object
cannot accidentally persist an unsaved practice form. Selecting a mode restores
its browser config, otherwise its project default, otherwise its built-in setup.

Camera and perspective presets retain stable IDs for replacement. Explicit
browser override IDs distinguish a deliberate save of a built-in value from an
untouched built-in preset; legacy custom presets remain readable.

Editor recovery remains an automatic browser draft, separate from the saved
library. Handedness and the room-safety acknowledgement remain personal browser
preferences, not publishable project content. Capturing a transition position or
direction edits the drill draft; Save drill publishes the complete result.
JSON export remains a download, not a catalog save.

## Storage and failure contract

- Project drills: `src/content/project-drills.json`.
- Project shots: `src/content/project-shots.json`.
- Project configs and presets: `src/content/project-configs.json`.
- Personal saved items/configs: `tenmulate.appData.v2`, extending the existing
  schema without deleting legacy data.
- Editor drafts: the existing independent editor-draft cache.

All project catalogs use the same atomic-file store and compare-and-swap revision
handling. Config validation stays outside the gameplay dependency graph so edits
to physics do not restart Vite. Browser saves perform the storage write before
acknowledging success or changing saved library state. Quota/access errors retain
the form; project conflicts refresh the revision and require an explicit retry.
Cancellation writes nothing. No destination is remembered as an automatic choice
in development. The modal traps focus, restores it on dismissal and handles
Escape only for the topmost dialog. Success notices do not block court controls.

Browser deletions use local hidden IDs so a deleted default does not reappear on
reload. In development, deleting a project entry retains the existing explicit
project deletion behavior. Already-placed drill events keep their own snapshots.

See the [saving architecture audit](../development/saving-system.md) for current
call paths and verification. This changes local implementation and production
build behavior; it does not constitute deployment or owner acceptance.
