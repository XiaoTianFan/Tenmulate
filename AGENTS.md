# Tenmulate agent guide

- This repository owns the React/TypeScript/Vite app, Three.js gameplay renderer, ball physics and deterministic session clock.
- Motion production is the independent sibling `../Tenmulate_motion_analysis`; keep video, Python environments, solve intermediates and Blender motion masters there.
- Start with `README.md`, `docs/development/implementation-status.md` and the relevant architecture/decision record.
- Use Node 24.x. Install with `npm ci`; run `npm run dev` (127.0.0.1:4173). `npm run check:release` runs tests and the production build.
- Release configuration, GitHub/Vercel state and handoff live in `docs/development/release.md`. Never commit local tools, credentials or temporary QA artifacts.
- Motion contract: `docs/development/local-motion-pipeline.md`. Active manifests are `src/content/opponent-motion.json` and `src/content/opponent-asset.json`; publish them with matching assets/provenance.
- Preserve source clock, rigid grips, contact anchors, fixed bone lengths and both-hand behavior. Verify the actual rendered gameplay after blending/IK, not only isolated clips.
- Keep ball pace separate from motion rhythm; use the shared recovery planner for both schedule and playback.
- Run `npm run check:motion` after motion/model integration. The build verifies the active bundle is the only opponent GLB precached.
- Commit focused stages and update canonical dev docs. Accepted ADRs are historical decisions: supersede them rather than rewriting their decisions.
- Local implementation, merge, live review, owner acceptance and public deployment are distinct states.

