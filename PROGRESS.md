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

- Local-only continuation: six new AudioPalette ownership/error tests pass without network or browsers. Covers coalesced loads/cache reuse, empty 204 interception, same-length corruption, decoder rejection/retry, stale uncancellable decode after exit, eight-second timeout cleanup. Combined audio suite: 18 tests / 4 files; TypeScript build check passed under Node 24.19.0. These are stubbed transport/decoder control-flow tests, not acoustic/device evidence.

- OWNER STOP, 2026-09-17: no further browser media requests or downloads after repeated IDM popups. Stopped timing test (8187), Firefox download (73403), dev server (10446), preview (64115); process check found no remaining task-owned headless Edge. Preserve this constraint across goal continuations. Do not retry via another browser/transport or alter IDM.
- Integration committed f57fc55. New gameplay timing harness is unqualified: first run reported zero measured events and failed, revised polling run was stopped before a result. No 100-event acceptance claim. Only offline/local code work may continue without renewed owner authorization for browser activity.
- Browser verification entrypoints now guard before importing/launching Playwright, to prevent accidental reruns. Firefox download did not finish and no Firefox qualification occurred.

- Baseline command: prepend bundled Node bin to PATH; invoke Node explicitly with `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js run check:release`.
- Vitest and its workers verified via process executable path to use bundled Node 24; nested npm wrapper itself uses system Node 25, which does not execute application tests.
- First npm ci attempt accidentally used Node 25 through its wrapper; the successful explicit Node 24 rerun is the installation baseline.
- Asset research corrected the original racket candidate: MIKEJONESBONES 511825 is a swing/whoosh, not a contact.
- Verified CC0 impact candidate kletton97 710041; acquired its openly served HQ MP3 preview (not the login-gated original). Public preview source is lossy and will be recorded as such.
- Downloaded qubodup's CC0 Well Done FLAC from OpenGameArt; the source page explicitly relicensed the old CCBY3-named file to CC0 on 2024-10-05.
- Source artifacts are ignored under tmp/audio-sources. Live playback was unchanged at that historical palette stage; integration is now committed.
- Palette stage: 15 hashed WAV/MP3 files, 552169 bytes, complete source/output provenance and deterministic builder. Recorded contact is one take with three tonal variants, not three independent recordings. Bounce is authored synthesis. Two applause variants derive from one CC0 recording. Crowd murmur is jayfrosting's CC0 studio-audience preview, filtered and loop-crossfaded.
- Added six venue profiles and pure PCM functions for surface transients, environmental loops and impulse responses. These are artistic, not measured room acoustics.
- Focused check: bundled Node 24 -> `node_modules/vitest/vitest.mjs run --maxWorkers=1 tests/audio-acoustics.test.ts tests/audio-palette.test.ts`: 7 passed / 2 files, 0 skipped.
- Baseline completed in 227.11 seconds. Existing >550kB bundle warning remains; active opponent bundle remains tennis-local-v1.64f3bc37161d.glb, 25 clips, 1.88m.

## Next

## Graph stage — not wired into gameplay yet

- Added SoundscapeGraph: actual Web Audio buses, shared post-effects master, bounded soft saturation, spatial pan, 32-voice limit, two-convolver transition limit, fade/mute, sweep/reset/dispose.
- Added AudioPalette: coalesced loads, source-byte/hash checks, decode memory budget, cancellation generations, explicit failure state/retry and procedural contact/bounce fallback. All-venue decoded palette + three procedural layers: 9514064 bytes; impulses are additionally accounted for by the graph.
- Added spatialSessionCues/AudioCueCursor: existing cue helper remains unchanged, physical metadata adapter, exact-zero opening, pause/seek suppression and audio-relative camera mix. Caller must explicitly reset cursor on restart/session replacement.
- Focused unit run: audio-acoustics, audio-palette, audio-spatial-cues and unchanged session-cues: 13 passed / 4 files; TypeScript build check passed. The clock test covers 101 impacts at each supported rate, but is not a real gameplay timing measurement.
- Real Edge 153 OfflineAudioContext checks in scripts/audio/verify-browser.mjs passed with local-byte fixtures: all six venue responses finite and non-silent, indoor tail ratios exceed outdoor, muted wet output energy is zero, 80-hit stress peak .8457 and max 32 voices, 60 rapid switches max 2 convolvers, reset/dispose zero voices/effects. Injected 404 -> fallback -> retry ready.
- NORMAL HTTP TRANSPORT IS NOT VERIFIED: Edge and separate Chromium browser fetches receive empty HTTP 204 for WAV/MP3; text returns 200. PowerShell and Playwright API requests get 200 and correct bytes (contact-0 30012). IDM is running; possible media interception, not confirmed. No IDM settings/processes were changed. User was asked asynchronously to exclude localhost or keep this gate open.
- Browser-plugin absent; regular bundled Playwright used. Interactive-js skill was inspected but js_repl is absent, so it was not applied and no global configuration was changed.
- DSP command: set AUDIO_PLAYWRIGHT_MODULE to bundled playwright/index.mjs file URL; set AUDIO_LOCAL_FIXTURES=1; run `node scripts/audio/verify-browser.mjs` under Node 24. Omit fixture flag for normal HTTP qualification. Dev server was started on 127.0.0.1:4185 (exec session 10446); verify its live handle before reuse.

## Integration stage — 2026-09-17

- The stage proposal below is now implemented: shared context/graph/palette, clock/camera adapter, lifecycle cleanup, bilingual crowd/retry controls, gesture unlock before drill compilation, hashed runtime cache and ADR-0057.
- Node 24 release passes 697 tests / 69 files, zero failures/skips, TypeScript/build/motion-cache guard (233.56 seconds). Existing bundle warning remains.
- Real Edge 153 graph/capture checks with explicit local-byte fixtures pass all 18 venue/audience combinations. Muted/paused captured RMS is zero, resume is nonzero, capture survives exit and idempotent release ends its track. Ten enter/exit cycles and completion cleanup return voices/convolvers/decoded bytes/loops/timers to zero.
- Capture pipe warmup was 540 ms; this is separate from event dispatch latency.
- Actual development Quick Practice shows normal HTTP failure and Retry recovery with fixtures without auto-resuming. Crowd toggle disables its slider. English/Chinese desktop settings visually inspected. Master mute removes sources/effects; exit clears buffers; no page errors. Short gameplay dispatch sample is insufficient for the 100-event budget.
- Remaining: production Quick Practice/drill/capture, timing across rates, visibility/seek/restart and load/codec faults, offline delivery and review recordings. Normal HTTP, owner listening and unavailable-device gates remain open.

## Integration stage proposal (historical)

Replace/wire AudioCueEngine only after preserving its unlock/play/setAmbience/capture contract. It remains the original oscillator implementation. Proposed owner: one shared AudioContext/SoundscapeGraph/AudioPalette, stable status subscription, environment/surface/levels configuration, playback status lifecycle, no-speech reactions on session completion only, bounded cleanup timer, output captured after master. Loop gains follow environmentalLevels and audienceGain. Scene exit clears buffers/loops while capture lease/context remains. RehearsalScreen should use the spatial adapter/cursor, explicit restart reset, sampleCameraTimeline for pan, default ambience .3/crowd .3, master mute and translated status/retry controls. App.drillLaunch must unlock synchronously before async compilation. Do not change simulation clocks.

Then add PWA audio cache rules, ADR, engine/lifecycle/browser/capture tests, recordings and full acceptance matrix. Owner/real-device listening remains open. Update this file each committed stage.
