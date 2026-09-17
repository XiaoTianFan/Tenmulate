# Audio refactor progress

## Execution receipt — 2026-09-17
1. Owner launched the venue-aware audio goal; retain the full research-plan scope.
2. Planning commit: 2666c05; implementation start tree was clean.
3. Use bundled Node 24.19.0 explicitly; default npm wrapper uses Node 25.
4. Node 24 npm ci succeeded (543 packages, audit 0 vulnerabilities).
5. Baseline release passed: 685 tests / 66 files, build and motion/cache guard.
6. Sequence: baseline, verified assets, graph/lifecycle, integration, browser/DSP QA.
7. Main risk: synchronizing audio with the capped simulation clock and lifecycle.
8. Preserve motion/physics, existing test assertions, capture leases and local edits.

## Live work

- Baseline command: prepend bundled Node bin to PATH; invoke Node explicitly with `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js run check:release`.
- Vitest and its workers verified via process executable path to use bundled Node 24; nested npm wrapper itself uses system Node 25, which does not execute application tests.
- First npm ci attempt accidentally used Node 25 through its wrapper; the successful explicit Node 24 rerun is the installation baseline.
- Asset research corrected the original racket candidate: MIKEJONESBONES 511825 is a swing/whoosh, not a contact.
- Verified CC0 impact candidate kletton97 710041; acquired its openly served HQ MP3 preview (not the login-gated original). Public preview source is lossy and will be recorded as such.
- Downloaded qubodup's CC0 Well Done FLAC from OpenGameArt; the source page explicitly relicensed the old CCBY3-named file to CC0 on 2024-10-05.
- Source artifacts are ignored under tmp/audio-sources. Live playback is not changed yet.
- Palette stage: 15 hashed WAV/MP3 files, 552169 bytes, complete source/output provenance and deterministic builder. Recorded contact is one take with three tonal variants, not three independent recordings. Bounce is authored synthesis. Two applause variants derive from one CC0 recording. Crowd murmur is jayfrosting's CC0 studio-audience preview, filtered and loop-crossfaded.
- Added six venue profiles and pure PCM functions for surface transients, environmental loops and impulse responses. These are artistic, not measured room acoustics.
- Focused check: bundled Node 24 -> `node_modules/vitest/vitest.mjs run --maxWorkers=1 tests/audio-acoustics.test.ts tests/audio-palette.test.ts`: 7 passed / 2 files, 0 skipped.
- Baseline completed in 227.11 seconds. Existing >550kB bundle warning remains; active opponent bundle remains tennis-local-v1.64f3bc37161d.glb, 25 clips, 1.88m.

## Next

Implement and test real graph/resource limits and the enriched cue adapter; integrate UI/capture; run the full plan's acceptance matrix. Actual-browser/OfflineAudioContext/physical listening evidence is still pending. This file must be updated at every committed stage.
