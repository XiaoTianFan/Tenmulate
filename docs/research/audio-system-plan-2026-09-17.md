# Venue-aware tennis audio: proposed implementation goal

Status: Proposed for owner review; implementation has not started.
Research date: 2026-09-17. Inspected revision: `e78d086`.

## Purpose and proposed defaults

Replace electronic impact beeps and the constant ambient hum with convincing racket/ball contacts, surface-specific bounces, environmental sound and restrained audience reactions. The six existing venues should sound different without obscuring practice timing.

Proposed defaults (assumptions for review): subtle ambience after the user's Start gesture; crowd follows the existing empty/half/full audience selection and has an independent level/mute. Keep countdown and footwork training cues distinguishable from physical sounds. No music, commentary, invented scores or cheers after every hit. Pause and backgrounding fade environmental sound out; resumed playback restores it. Rest can retain quiet ambience. Exit/completion fades the soundscape out, allowing a bounded completion reaction. Master mute silences every bus, including effects tails and capture.

Realism needs owner listening review. Automated success cannot establish it. No implementation, installation, release check, asset audition or device qualification is claimed by this plan.

## Current evidence and integration boundaries

- `src/engine/audio/AudioCueEngine.ts`: a shared lazy AudioContext, five oscillator cues, one 74 Hz sine ambience, and a capture tap. Ambience zero currently targets a nonzero floor. Unlock failures are swallowed.
- `src/engine/audio/sessionCues.ts`: contacts/bounces derive from compiled flights/repetitions; footwork is a training cue. The crossing helper suppresses backward changes and jumps over 0.2 seconds. Preserve existing tests; add a richer adapter if extra event metadata would break exact-object assertions.
- `src/components/RehearsalScreen.tsx`: frame-based crossing checks, separate levels, ambience initially zero. `SetupScreen` unlocks on Start. Audit every other launch/resume route for gesture handling.
- `src/domain/environment.ts`: six venues; three outdoor and three indoor; hard/clay/grass surfaces; audience empty/half/full; wind/weather settings. Use these authoritative definitions rather than venue-name guesses.
- ADR-0015: the compiled session clock owns timing. It currently advances with a capped frame delta; do not blindly schedule sound against independent wall time during a renderer stall.
- ADR-0034: court capture taps the same output and keeps its lease across routes. Preserve speaker output, track lifecycle and absence of microphone permissions.
- `vite.config.ts`: audio extensions are absent from the precache glob; venue/audience runtime caches are bounded. Add a separate bounded, versioned audio policy without broadening motion caching.
- Clean worktree at inspection; Node `v25.2.1`; `node_modules` absent. Package requires Node 24.x. `npm ci` and `npm run check:release` exist but were not executed in this planning task. The latter runs Vitest, TypeScript, Vite and the motion integration guard. The status document's historical 678 tests is not a verified baseline for this checkout.

## Architecture recommendation

Use native Web Audio, with no runtime audio framework initially. MDN recommends buffers for short sampled sounds and media elements for longer streamed material; user interaction is needed for reliable context startup. Keep bounded short ambient loops in decoded buffers for seamless scheduling; use a media element only if a measured need for longer material justifies its lifecycle and loop complexity. [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

Graph: reusable sample buffers / procedural layers -> per-voice gain and position -> impact, training, ambience and crowd buses -> dry output plus venue reflections/reverb -> master headroom/level -> speaker and capture destinations. Training cues stay mostly dry. Avoid double reverberating already-wet crowd recordings. One convolver normally, two only while crossfading venue profiles. ConvolverNode accepts an impulse-response buffer; generated responses avoid needing recordings of these fictional venues. This is an artistic acoustic model, not a measured room simulation. [ConvolverNode](https://developer.mozilla.org/en-US/docs/Web/API/ConvolverNode).

Separate pure cue/profile/variation logic from Web Audio resource ownership. Stable event identifiers and session generations prevent duplicate events and late async publication. Own cancellation for loads, schedules, tails and transitions. Sample choice uses an audio-only seed so it never consumes physics randomness. Prefer dry transients plus subtle bounded pitch/gain differences; avoid turning every hit into the same ping. Use available contact/bounce velocity and coordinates, and documented conservative defaults when metadata is absent. Do not infer a winner from a bounce or a failed return.

Anchor events to the current simulation clock and playback rate. Any lookahead must be short, cancellable and rebased on pause, rate change, seek, restart and clock discontinuity. Explicitly test initial time-zero contact and reduced frame rate. Do not change the deterministic clock to make audio scheduling easier. Preserve source/camera coordinate conventions, including handedness; listener positioning should follow the active viewpoint when a stable integration exists.

Handle fetch/decode/autoplay failures with a compact bilingual status and retry path. A clearly identified procedural fallback may keep rehearsal usable, but no silent substitution presented as a successfully loaded sample. Audio must never block ball simulation indefinitely.

## Venue palette and mixing

These are initial tuning hypotheses, not measurements. Adjust through listening while retaining the indoor/outdoor distinctions.

| Venue | Proposed acoustic identity |
| --- | --- |
| hard-open-arena | Clear hard-court impacts; sparse distant stand reflections; low outdoor bed. |
| clay-sunset-arena | Softer clay bounce; open-air tail; quiet wind when configured. |
| grass-center-court | Duller, shorter bounce; restrained open grandstand reflections. |
| timber-hall | Warm early reflections and a denser, damped hall tail. |
| clay-stadium | Broad indoor-stadium reflections and longer diffuse decay. |
| covered-grass-arena | Audible roof reflections, softer bounce and distinct indoor decay. |

Surface follows the selected playing surface even when overridden from a venue default. Weather/wind follow existing settings; do not add outdoor rain/bird beds to enclosed halls. Start with roughly 0.15-0.5 s outdoor decay and 0.7-1.8 s indoor decay, with low wet levels and filtered early reflections rather than obvious musical repeating echoes. Tune against intelligibility, not an arbitrary realism score.

Audience density scales the murmur and reaction size. Empty means no crowd energy at all. Duck crowd during the rally; react only to supported authored point endings or session completion, with a cooldown and bounded duration. If point outcome is not represented, omit that reaction rather than adding scoring logic. Provide at least several distinct impact takes/variants and more than one reaction to avoid obvious repetition.

## Sources, synthesis and asset delivery

Recommended hybrid: recorded dry racket transients and human crowds, authored noise/resonance for wind, room tone, bounce reinforcement and impulse responses. Human crowd synthesis alone is less likely to be convincing and must not be labeled as real recording. Audition every source before selecting it.

| Candidate | Evidence and remaining work |
| --- | --- |
| [Tennis racket 1.wav, MIKEJONESBONES](https://freesound.org/people/MIKEJONESBONES/sounds/511825/) | Search index identifies CC0; direct fetch timed out. Candidate only: re-open license, obtain a permitted download and audition dry isolation before use. |
| [Crowd cheer.wav, BeeProductive](https://freesound.org/people/BeeProductive/sounds/430046/) | Source page verified CC0, medium crowd clapping/cheering, 15.953 s stereo 48 kHz/24-bit WAV, 4.4 MB. Login is required for original download. Not downloaded or auditioned. Find an accessible licensed alternative or author a replacement if acquisition is unavailable; never bypass login. |

These are leads, not a complete asset pack. Still source/audition surface bounces and quiet crowd murmur. Prefer CC0; accept CC BY only with complete notices. Exclude unclear rights, noncommercial-only content and broadcast extracts. Record each exact source/license URL, author, retrieval date, transformations, source/output hashes and generation/transcoding recipe. Preserve required notices in the shipped assets and docs/asset-attribution.md. No API key, account creation or third-party network request at runtime.

Ship short mono impacts as 16-bit PCM WAV (preserves transients and avoids lossy onset padding); use compact stereo MP3 for longer beds/reactions as the initial compatibility baseline. Optional Ogg/Opus variants require tested decode support and MP3 fallback. Ogg Opus support depends on Safari/OS versions, so it must not be the sole assumed format. [MDN media containers](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers). Use 44.1 or 48 kHz consistently in production assets; generated buffers should respect context sample rate. Keep large masters and temporary audition outputs outside shipped assets.

Lazy-load the active palette, reuse common impacts, cache content-hashed URLs and coalesce requests. Cap decoded memory and release inactive palettes; compressed transfer size alone does not bound decoded memory. Offline play after a successful warm load must work. Cold offline missing assets must expose a controlled fallback/status rather than hang.

## Proposed acceptance budgets and verification matrix

These budgets are new acceptance targets, not baseline measurements:

- At most 6 MiB of shipped runtime audio including alternate encodings; at most 32 MiB of live decoded PCM, including responses and transition buffers; at most 32 active source voices and two convolvers during transitions. Inventory network bytes separately from decoded memory; no fetch/decode per impact.
- Steady foreground playback: 95th-percentile event dispatch/schedule alignment within 40 ms of authoritative event time across supported rates, measured over at least 100 contacts/bounces. Report output latency separately; this is not a speaker-to-ear or Bluetooth guarantee.
- Offline renders: finite non-silent selected effects, no clipped samples (absolute peak below 1), different surface/tail signatures, zero crowd when empty, master mute below -80 dBFS after a fade of at most 100 ms, including wet output and captured output. Compare reverb tail energy at matched dry levels rather than simply comparing loudness.
- Profile all six venues x three audience states. Exercise surface overrides, wind/rain, crowd suppression during rallies and supported end reactions. Listen for harsh beeps, exaggerated delay, obvious loop seams, clicks and masking.
- Test pause/resume, seek both directions, exact-zero start, restart, 0.5/0.75/1/1.25 playback, background/foreground, mute during a tail, rapid venue changes during pending loads, unavailable codec, fetch/decode failure, repeated launch/exit and capture lease release.
- Ten launch/exit or venue-switch cycles must return resources to documented idle bounds with no accumulating sources/timers. Run actual production-browser Quick Practice and drill playback. Preserve capture tracks while switching route/config and verify its audio contains the same mixed output without doubled playback.
- Run baseline and final release checks under Node 24, add focused pure-logic and real OfflineAudioContext tests, then perform actual-browser checks. Do not mock the engine under test as acoustic evidence. Inject one missing asset, verify recovery reporting, restore it and show red-to-green results.
- Record exact browser/OS versions. Verify available Chromium/Edge and Firefox; real Safari/iOS resume/offline/listening checks remain OPEN if unavailable. Browser emulation or a headless WebKit run cannot certify real iPhone behavior. Produce short matched-level gameplay A/B recordings for owner listening; no automated assertion substitutes for owner approval.

## Execution stages and delivery

1. Establish Node 24/dependency/test baseline and write the execution receipt.
2. Audition and prepare a minimal licensed/procedural palette with provenance.
3. Implement graph, lifecycle, scheduler adapter and focused regression tests.
4. Integrate venue/crowd behavior, bilingual controls and offline cache rules.
5. Verify budgets, actual gameplay/capture, update canonical docs and commit focused stages.

Keep PROGRESS.md and BLOCKED.md for resumability. Preserve all existing test expectations; add tests rather than weaken them. After three identical failures change approach, and document evidence-backed blockers instead of reporting success. Unavailable owner/device checks are explicit remaining acceptance gates. Local implementation, merge, owner acceptance and public deployment remain separate. This goal authorizes local implementation only when manually launched; no push/deployment is included.
