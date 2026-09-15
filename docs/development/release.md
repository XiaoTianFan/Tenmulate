# Release and hosting runbook

Verified **2026-09-16** (Asia/Shanghai). This page owns current remote and hosting
state; older implementation receipts describe their dated runs.

## Source and production

- Public repository: [XiaoTianFan/Tenmulate](https://github.com/XiaoTianFan/Tenmulate).
  `main` tracks `origin/main`; existing source history is preserved.
- Live site: **https://tenmulate.xiaotianfanx.com**. HTTPS and Vercel DNS verified.
  The root domain and unrelated projects were not changed.
- Vercel team/project: `xiaotianfans-projects/tenmulate`, project ID
  `prj_Tj1tvVnPjcCEanLxVaeUYma9VUP3`, connected to the GitHub repository.
- Verified code commit: `1d92d2d`. Successful production deployment:
  [DpgZtXc4QaHyRx85Pe52XxmRyNWS](https://vercel.com/xiaotianfans-projects/tenmulate/DpgZtXc4QaHyRx85Pe52XxmRyNWS).
  Subsequent documentation-only deployments may carry a newer commit.
- Public visibility does not grant a repository-wide open-source license. No such
  license has been selected; third-party assets retain their own licenses. See
  [asset attribution](../asset-attribution.md).

## Build and deploy

Use Node **24.x** (`.node-version`, package engines, CI and Vercel agree):

```sh
npm ci
npm run check:release
```

The release command runs all tests, TypeScript, Vite and active model/motion/cache
validation. Test files run serially because physics and motion suites are CPU-heavy.
Build output is `dist`; no credentials, database or motion laboratory are required.
Runtime assets are tracked under `public`; optional Blender sources live in `assets`.

Vercel uses framework Vite, root `.`, install `npm ci`, build `npm run build`,
output `dist`, and Node 24. No environment variables are required. For CLI work,
use `vercel link` to select the existing team/project, `vercel` for a preview,
and `vercel --prod` for an authorized production deployment. Keep `.vercel` local.
Git integration deploys pushes to `main`; deployment success alone does not prove CI
passed. Check the exact commit's **Release checks** before accepting a release.

CLI upload exclusions in `.vercelignore` are rooted deliberately: `/assets` excludes
Blender sources, while `public/assets` must be uploaded. A bare `assets` excluded
both directories and caused the first deployment's motion-manifest ENOENT failure.
`tests/deployment-inputs.test.ts` guards the required runtime/build inputs.

The app navigates in memory at `/`; no catch-all rewrite is needed. HTML and `sw.js`
revalidate. The Vite PWA configuration owns precache and runtime venue caching.
Development `/__tenmulate/project/*` write middleware is absent in production.

For rollback, promote the previous verified deployment in Vercel without rewriting
Git history. Check the canonical URL, active GLB and browser flow after promotion.
Browser saves belong to their origin and do not migrate automatically between
localhost, preview URLs and the canonical domain.

## Verified release evidence

- [GitHub Actions 34992021656](https://github.com/XiaoTianFan/Tenmulate/actions/runs/34992021656):
  clean Linux Node 24 release check, **678 tests / 65 files**, build and motion guard pass.
- Vercel production build passes: 38 precache entries, 25 motion clips, 1.88 m model.
- Live active GLB returns HTTP 200 and matches SHA-256
  `64f3bc37161dfc2fcf536e80a6e39465792bdc6a822dd26493d04d2ab2bd3eaf`.
- Live Edge: Rally default, rendered court, direct browser config save, Chinese
  language retained on reload, English switch and two-repetition serve-return drill
  complete (4 player shots, 32 seconds). The development write URL returns 404.
- No application console errors observed. ANGLE shader precision warnings and the
  large Three.js bundle warning remain; build tools emit glob deprecation notices.
- The deploy install audit reports zero dependency vulnerabilities at verification.
- Prepublication inspection found no tracked environment/private-key/video/database/
  ZIP files, no common credential-pattern matches across the audited source history,
  and no blob exceeding GitHub's file limit. This was a bounded pattern audit.

## Closeout and retained work

The owner approved cleanup after reviewing the prior inventory. Merged local feature
branches and disposable localization/release scripts, logs and old browser evidence
are removed. Current live evidence is retained locally in ignored `output/release`.
Reference PDFs in `tmp/pdfs`, reusable `.tools`, tracked authoring sources and the
Vercel link are retained. Git object housekeeping is left to Git; no objects are
manually deleted.

| Surface | Current state |
| --- | --- |
| Code | changed-and-verified: deploy input regression and CI pass |
| Runtime | changed-and-verified: public HTTPS deployment and live drill completion |
| Documentation | changed-and-verified: current hosting authority and linked entry points |
| Rules | verified-current: root AGENTS.md remains the project rule source |
| Memory | out-of-scope: generated/read-only, no memory changes |
| Workspace | changed-and-verified: approved residue removed, unique sources retained |

## Remaining acceptance work

Public hosting is complete. Long mixed-session soak, the full target-device/browser
matrix, real TV/projector calibration, owner/coach technique review, comprehensive
asset-rights review and repository-wide licensing remain separate gates. Offline
and service-worker upgrade acceptance also need a dedicated live lifecycle test.
Do not infer those results from this release smoke test.
