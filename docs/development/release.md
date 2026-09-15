# Release preparation and hosting runbook

Current preparation date: **2026-09-15**. This page is the authority for remote
and deployment state; older implementation receipts describe their dated local runs.

## Source and hosting

- GitHub: [XiaoTianFan/Tenmulate](https://github.com/XiaoTianFan/Tenmulate), private
  release-preparation repository. `origin` points to its HTTPS Git URL.
- Vercel team: `xiaotianfans-projects`. No Tenmulate project exists yet. Do not
  repurpose the team's unrelated projects.
- Local Vercel CLI is installed but its token is invalid. The connected Vercel
  integration can list the team/projects. Production has **not** been deployed.
- Public repository visibility and repository-wide source licensing remain owner
  decisions. Private upload does not grant an open-source license.

## Reproducible build

Use Node **24.x** (`.node-version`, package engines, CI and Vercel agree):

```sh
npm ci
npm run check:release
```

Test files run with one worker to avoid CPU-heavy solver suites competing with one
another. Multi-scenario rally and motion checks are named per batch/hand/shot, with
all original assertions and per-case timeouts retained. Documentation-only commits
do not retrigger runtime CI.

The release command runs all tests, TypeScript compilation, the Vite build and
active model/motion/precache verification. Build output is `dist`. No external
service credentials or motion-laboratory installation are required. Runtime
assets are committed under `public`; optional Blender sources live under `assets`.

The migration tests use an empty project-config fixture so editing shipped defaults
cannot replace their test inputs. Save integration tests still read the real project
catalog and verify browser overrides. Shipped drills are validated for schema and
unique identity instead of assuming the fallback library's historical size.

## Vercel handoff for Homie / the owner

1. Import `XiaoTianFan/Tenmulate` from GitHub into a **new** `tenmulate` project in
   `xiaotianfans-projects`, or identify the intended existing project explicitly.
2. Use framework **Vite**, root `.`, Node **24.x**, install `npm ci`, build
   `npm run build`, output `dist`. These build settings are in `vercel.json`.
3. No environment variables are required. Do not upload development credentials.
   CLI uploads use `.vercelignore` to exclude tools, evidence and Blender sources.
4. Before production promotion, check the **Release checks** GitHub Actions run for
   the exact commit. Git integration can deploy before CI finishes; its existence
   is not proof that tests passed. Validate a preview before promoting it.
5. If using the CLI, run `vercel login`, then `vercel link` and select the exact
   team/new project. Run `vercel` for preview. Production promotion is a separate
   reviewed action; do not overwrite another application's project or domain.
6. Record the deployment URL, commit SHA, project identity and live checks here.
   For rollback, promote the previously verified deployment in Vercel; do not
   rewrite Git history. Existing browser saves are origin-local and do not migrate
   automatically to a different preview/production domain.

This app uses in-memory navigation at `/`; no catch-all rewrite is needed. Static
assets and the review page must retain their own paths. HTML and `sw.js` revalidate;
asset filenames carry content hashes where managed by the renderer. Runtime venue
caching is defined in Vite's PWA configuration. The local `/__tenmulate/project/*`
write endpoints are development middleware, not Vercel Functions.

## Live acceptance checklist

- Open the canonical URL in English and Chinese; verify default language and switch.
- Load a court, begin a practice and run a repeated drill with rest.
- Save a browser config/shot/drill, reload and confirm it persists with no project
  destination prompt. Confirm user text retains its authored language.
- Confirm GLB/worker requests succeed, console has no app errors, and the active
  opponent hash matches `src/content/opponent-motion.json`.
- Reload an updated deployment with an existing service worker; then exercise
  already-loaded assets offline. First-time offline use is not supported.
- Complete target-device frame-time/soak and owner technique review before claiming
  all public V1 acceptance gates passed. Review [asset provenance](../asset-attribution.md).

## Cleanup inventory and scope

| Surface | State / disposition |
| --- | --- |
| Code | Release configuration and deterministic storage test fixtures updated; verification results below. |
| Runtime | Local build verification; Vercel live verification pending. |
| Documentation | README reduced to an entry point; feature details preserved in user guide; release and provenance linked from current records. |
| Rules | Root AGENTS.md remains the single project rule source; no parent rule files or competing CLAUDE files found. |
| Memory | Generated-read-only; no global memory changes authorized or made. |
| Workspace | One worktree (`main`); 15 other local branches are already merged. No branches or evidence deleted. |

Deletion candidates are **preview only**, retained for owner review:

- `tmp/`: one-off localization/release scripts, logs and reference PDFs; inspect PDF
  provenance before removing the whole directory.
- `.playwright-cli/`, `output/playwright/`, root `*.log`: local test evidence; retain
  any screenshots needed for release review.
- `.git/objects/35/tmp_obj_udVm2p` and `.git/objects/92/tmp_obj_vrZ8mh`: two Git-reported
  temporary garbage objects (about 1.23 MiB). Let Git housekeeping handle these only
  after a reviewed backup/cleanup decision; no manual object deletion performed.
- 15 merged `codex/*` branches: no unique commits, but retained until cleanup approval.

`.tools/` contains reusable Blender tools/environments, not disposable task residue.
`assets/` contains tracked authoring sources; keep them. `node_modules/`, `dist/`
and QA artifacts are ignored, not source-release inputs. Physical deletion is a
separate post-report approval step required by the invoked neat-freak skill.

## Verification record

Git inspection found no blobs above GitHub's file limit: the largest reachable blob
is 22,271,747 bytes. A bounded scan for common token/private-key patterns found no
matches in 216 reachable pre-release commits. No tracked environment, private-key,
video, database or ZIP files were found. This is a pattern audit, not a guarantee
that every possible secret format has been detected.

Official hosting references: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite),
[Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions),
[vercel.json](https://vercel.com/docs/project-configuration/vercel-json),
[GitHub file limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).
