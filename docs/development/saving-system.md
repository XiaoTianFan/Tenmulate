# Saving architecture and verification

Updated: 2026-09-12. Contract: [ADR-0053](../decisions/0053-unified-save-destinations.md).

## Audit and resulting behavior

| Entry point | Previous behavior | Current behavior |
| --- | --- | --- |
| Editor Save drill | Project-only; disabled without the project API | Shared destination flow; available in production |
| Library Import JSON | Immediately wrote the project catalog | Parse and validate, then shared drill save |
| New/updated shot preset | Project-only with several different save labels | Save shot, with creation/replacement in its form, then shared destination flow |
| Quick Practice controls | Debounced writes to app localStorage on every edit | Live form across route changes; explicit Save config per mode |
| New/right-click camera or perspective preset | Direct browser write | Save preset through the same destination flow |
| Camera transition capture | Changed the editor draft | Still draft editing; persisted by Save drill |
| Editor recovery | Automatic browser draft cache | Retained independently of library saves |
| Handedness and safety acknowledgement | Personal browser preference | Retained; not project-default content |
| Export JSON | File download | Retained; independent of save destinations |

The old project-first merge hid browser edits to bundled items, and production
disabled drill/shot saving despite having usable browser storage. Both are fixed.
Production preview previously exposed project writes; only the development server
now installs those endpoints.

## Code paths

`App.tsx` connects the shared `useSaveSystem` destination coordinator to typed
operations. `useProjectDrills`, `useProjectShots` and `useProjectConfigs` read
bundled defaults and use development-only HTTP adapters. The three adapters share
`server/projectStore.ts` for loopback/origin checks, bounded bodies, revisions,
serialized mutations and atomic file replacement.

`useAppData` keeps durable data separate from live practice preferences. Explicit
mutations write `tenmulate.appData.v2` synchronously before updating React's saved
state. `savePolicy.ts` owns destination policy and browser-write failure wording.
Drill/shot upserts reuse their catalog validators and identity rules for either
destination. Browser overrides win; project promotion removes the corresponding
override. Preset override IDs preserve deliberate personal copies, including a
copy equal to a shipped value. Existing browser records and migration paths remain.

`projectConfigs.ts` validates complete practice configurations and position/look
presets without runtime gameplay imports. The config catalog is bundled into
production. Browser configs override project configs by practice category.
Saving the project default does not deploy it: rebuild and publish separately.

The browser is origin-scoped: localhost, 127.0.0.1, different ports and a deployed
domain have different storage. Closing a tab preserves saved items; clearing site
data removes them. Draft recovery is not a saved library version. Development's
destination chooser is shown for every explicit save, including when project
storage is unavailable; its browser option remains usable.

## Verification receipt

- Full automated suite: **638 tests / 61 files**. Production build, TypeScript and
  active motion/precache guard pass. Existing chunk-size advisory remains.
- Storage coverage: four mode configs, per-mode seed/camera values, browser
  override precedence, retained legacy storage, durable deletion markers,
  failed browser writes, project config readback, independent catalog entries,
  stale revisions, malformed config rejection and production-preview API absence.
- Actual Edge development UI: cancel with no write; browser drill save; fresh
  volley preset; project promotion clearing its local drill override; reloads;
  configs saved at Rally 71, Return 145, Volley 72 and Overhead 53 km/h; mode
  switching and reload restore the selected values. Project camera preset and
  browser perspective preset both remain available after reload.
- Actual Edge production build: Save config, Save preset, Save drill and Save shot complete
  without a destination chooser; saved content survives reload. Captured network
  requests contain **zero** `/__tenmulate/` API calls.
- Failure injection: browser quota error leaves bytes unchanged; an HTTP 409
  keeps the destination dialog open, and explicit retry succeeds. No silent
  browser fallback occurs for a failed project operation.

Evidence directory:
`C:/Users/20378/.codex/visualizations/2026/09/12/01a09414-f625-7dd2-ba82-d570264839e1/save-system/`.
Development UI project writes used copied catalogs and a separate Vite config;
the owner's drill/shot catalogs were not modified by verification. The temporary
server uses its own optimizer cache. A shared-cache stale-dependency error and
loading production while rebuilding were resolved before final browser checks.
The deliberate HTTP 409 is the only error in the final development failure test;
existing WebGL shader warnings remain. Production's final run has no browser errors.
An intermediate full-suite run overlapped the build and live renderers and hit
three existing 5-second simulation timeouts. Closing QA windows and rerunning
`npm test` alone passed all 638 tests in 30.94 seconds without changing timeouts.

Implementation and local production verification are complete. No public deploy.
