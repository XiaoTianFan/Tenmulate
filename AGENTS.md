# Tenmulate contributor and agent guide

## Scope and documentation

- This repository owns the React/TypeScript/Vite frontend, Three.js renderer,
  ball physics and deterministic session clock.
- Start with README.md, docs/technical-architecture.md and docs/open-questions.md.
  Keep user-facing behavior in docs/user-guide.md and attribution in
  docs/asset-attribution.md. Keep development instructions here.
- Document current behavior, not task transcripts, dated verification receipts,
  deployment IDs or completed plans. Preserve genuinely open limitations.
- Keep credentials, machine-specific paths, private footage, source workspaces,
  tool installations and temporary QA artifacts out of commits. Asset production
  is separate from the frontend; only required delivery assets and provenance
  belong in the runtime.

## Build and checks

Use Node.js 24.x and npm. No API keys or external database are required.

```sh
npm ci
npm run dev
npm run check:release
npm run preview
```

Development serves at 127.0.0.1:4173. check:release runs Vitest, TypeScript, the
production build and the active motion/cache guard. Output is dist/. For focused
checks use npm test -- <test-file>; run npm run check:motion after motion changes.
Browser audio QA must use the guarded memory-only fixtures with no media HTTP
requests or downloads. Do not bypass explicit test opt-in guards or change
external download-manager settings.

## Runtime invariants

- Preserve source animation clocks, rigid grips, contact anchors, fixed bone
  lengths and both-hand behavior. Verify gameplay after blending/IK, not only
  isolated clips. Keep ball pace separate from motion rhythm, and share the
  recovery planner between scheduling and playback.
- Publish src/content/opponent-motion.json and src/content/opponent-asset.json
  with matching runtime assets and public provenance. Only the active opponent
  GLB should be precached. Preserve third-party notices and asset source hashes.
- Keep preview/session worker ownership cancellable; stale replies must not
  replace current settings. Preserve deterministic seeds and physical constraints.
- Production saves stay in browser storage. Project-file writes belong only to
  local Vite development middleware. Preserve user saves and draft recovery.
- Translate fixed UI and built-in content in English/Chinese. Never translate or
  silently replace user-authored names, descriptions or cues.

## Delivery

- Commit focused changes and preserve unrelated work. Update existing docs rather
  than adding parallel status ledgers. Keep historical decisions in Git history.
- The GitHub workflow runs release checks; vercel.json builds with npm ci and
  npm run build, publishing dist/. A separate Vercel project needs no app secrets.
- Verify build output and required asset paths before deployment. Check service
  worker updates and cached content when validating a release; retain a known-good
  deployment for rollback. Never equate local tests, merge, push, deployment and
  live/device acceptance. Publishing requires the task's authorization.
