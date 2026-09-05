# Local feature branch integration — 2026-09-05

## Six-venue and audience integration checkpoint

After the initial arena merge below, `main` advanced to `a631093` for the separate
local-motion production decision. The six-venue work continued on
`codex/six-blender-venues-audience` and committed in stages:

- `45e7d7f`: delivery contract.
- `25e363b`: three indoor Blender masters, six Performance exports and generated
  audience source/delivery atlases.
- `18141c5`: authored-only runtime, variant selection, occupancy, cleanup/retry,
  portable timber tangents and regression tests.
- `d1a916a`: final build/runtime and visual-verification documentation.

The concurrently active motion task shared this checkout. Its focused commit
`b2a082e` was kept intact; shared-file hunks and staging windows were coordinated.
Its next iteration remained in the sibling laboratory during this integration.

With a clean index/worktree, `git merge --ff-only codex/six-blender-venues-audience`
advanced `main` from `a631093` to `d1a916a`. An ancestry check of every local
`codex/*` branch returned no unmerged tips: the eleven earlier branches below and
the new six-venue branch were all included. No history was rewritten and no branch
was deleted. There are still no remotes; this is not a push or deployment.

The integrated source passes **179 tests / 21 files**, production build and twelve
raw glTF validators (zero errors/warnings), plus the production browser checks
in [Stage 18](visual-verification.md#stage-18-six-blender-venues-performance-and-seated-audiences--2026-09-05).
This checkpoint supersedes the old procedural default/fallback notes below.
Future feature work after this checkpoint is not asserted to be merged.

## Earlier grass/net refinement checkpoint

The owner authorized finishing grass/net refinement on the feature branch, then merging every feature branch into `main`.

Refinement commit `fdd28f5` was made on `codex/blender-hard-open-arena`. Initial `main` was `26a3c56` and was already an ancestor of that branch. `git merge --ff-only codex/blender-hard-open-arena` therefore advanced `main` to `fdd28f5` without conflicts, conflict resolutions or rewritten history. The other ten feature tips were already ancestors of the initial `main`.

| Feature branch | Audited tip | Integration |
| --- | --- | --- |
| `codex/ball-opponent-visibility` | `bcf9956` | Already included |
| `codex/blender-hard-open-arena` | `fdd28f5` | Fast-forwarded in this delivery |
| `codex/camera-height-shortcuts` | `26a3c56` | Already included |
| `codex/gameplay` | `4d40f5a` | Already included |
| `codex/opponent-itf-runoff-positioning` | `9e3cf02` | Already included |
| `codex/practice-direction-fixes` | `8222037` | Already included |
| `codex/quick-volley-receiver-preset` | `fadc13c` | Already included |
| `codex/return-serve-pattern` | `d04bca6` | Already included |
| `codex/slow-deep-lob-physics` | `85b4faa` | Already included |
| `codex/spin-rate-trajectory-tooltip` | `34e2244` | Already included |
| `codex/venues-camera-relative-movement` | `05c0bc5` | Already included |

Post-merge, `git merge-base --is-ancestor <feature> main` succeeds for all eleven feature refs. Branch names are retained; no branches were deleted. There are no configured remotes or remote-tracking branches, so this is local integration only, with no push or deployment.

Verification: **158 tests / 17 files pass on main**. The production build and three Blender builds passed on the identical integrated source tree. Actual production renderer verification covers the three authored venues, all six fallbacks, grass day/dusk/night and desktop/mobile. See [Stage 17](visual-verification.md#stage-17-grass-contrast-and-all-venue-net-density--2026-09-05). The procedural default, open visual/performance acceptance gates and existing running local servers are preserved.
