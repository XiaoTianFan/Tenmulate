# Venue-aware audio implementation

## Recorded contact upgrade — 2026-09-20

Twelve independent contacts replace the three pitch-shifted versions of one take:
four forehands, four serves and four slices from Jamesdrake89's CC0 tennis pack.
They are extracted from publicly available HQ MP3 previews, not lossless masters.
The source title and description establish the shot categories; they do not
establish calibrated impact velocity. Soft volleys/drop shots use the slice bank
as an authored approximation; overheads use the serve bank. Owner listening remains
open, including whether these extracted field recordings sound sufficiently dry.

Both preview and rehearsal pass actual shot family/spin metadata. A seeded selector
avoids the last two recordings in each group. Outgoing ball speed is explicitly an
intensity proxy, controlling gain, low-pass cutoff (4.2–11 kHz) and decay (110–240 ms).
Pitch variation is reduced to +/-0.5%. No extra contact is added, no impact timing
is shifted, and contact position errors are not invented.

The 12 short mono 48 kHz/16-bit WAVs are embedded as exact bytes in a lazy application
chunk (~370 kB uncompressed / 184 kB gzip) and decoded once. Racket contacts make
no media-file HTTP requests, preventing the previously observed IDM contact
interception. Vite's existing JS precache includes this chunk. Hash/size validation,
coalescing, timeout, generation cancellation and memory limits still apply. Public
WAV copies retain standard editable/exportable assets and provenance; the budget
counts both copies. Other sound transport is unchanged.

If a requested contact is still loading, another decoded recording is preferred.
Only an entirely unavailable contact bank uses the revised short noise/transient
and damped-resonance fallback. Dispatch diagnostics record the actual source ID
(or `procedural`) so tests cannot mistake fallback for sampled playback. Generic
loading/failure UI no longer incorrectly claims every impact is synthesized when
only a crowd/bounce asset failed.

Verification: 711 tests / 73 files; TypeScript, production build and motion/cache
guard pass. Memory-only actual Quick/editor playback verifies recorded source IDs,
no recent-take repeats, mute and settings continuity. Six-venue DSP and pending-load
cleanup tests pass within 32 MiB. Edge production capture and Firefox qualification
pass. The generated service worker serves the contact application chunk offline;
the twelve remaining media assets pass warm/offline/failure/recovery checks without
media HTTP. Twelve equal-RMS comparison renders cover old
recording, old fallback, new bank and new fallback in dry/open/indoor scenes; this
is signal-level matching, not a claim of equal perceived loudness or owner approval.

Rebuild: `node scripts/audio/build-contact-bank.mjs` (Node 24 + ffmpeg); full palette
builder also invokes it. Source hashes are pinned. Contact playback/selection tests:
`tests/audio-contact-bank.test.ts`. Review renders:
`scripts/audio/render-contact-comparison.mjs`, output in ignored `tmp/contact-review`.

## Setup and editor previews — 2026-09-20

Quick Practice configuration and the drill editor now play impacts from the actual
rendered flights, including continuous preview batches and repeated editor loops.
Venue ambience also plays on the drill library before launch. Browsers require an
initial interaction; the Sound section provides an explicit enable button. Hidden
pages and pending previews silence their mix, and route changes release the previous
preview. Session completion cheers remain exclusive to completed practice.

Sound is the last expandable configuration section, before save/launch actions.
One shared, visit-scoped mix supplies countdown, contact, bounce, footwork, ambience,
crowd volume, crowd enable and master mute in setup, the drill library/editor and
rehearsal. Launch, exit and route changes retain it; a full reload resets defaults.
Countdown/footwork controls apply to training cues during practice; preview impacts
follow the ball rather than playing an unrelated demonstration loop.

Validation: 704-test release suite/build, plus three new preview-clock tests
(20 focused preview/spatial/localization tests pass); memory-only Edge
checks cover actual Quick/editor impacts, editor looping, captured audible output,
master-mute silence and level continuity through Quick and drill launches. The
browser stays offline with media bytes supplied in RAM and zero native media HTTP.
Harness: `scripts/audio/verify-memory-setup.mjs`. Production Quick/drill/capture
and bilingual/mobile checks also pass. Browser DOM and screenshot checks confirm
Sound is last in all three configuration panels. Owner listening remains separate.


Status (2026-09-18): locally implemented and technically qualified. Final Node 24
check:release passed: 704 tests / 71 files, no failures/skips, TypeScript, production
build and active motion/cache guard. The existing bundle-size warning remains.
Actual production label/capture recheck and the rebuilt worker cache test passed.
Owner listening and real Safari/iOS remain OPEN. No merge/deployment occurred.
Historical blocked states below record the rejected HTTP approaches; all current
browser media qualification uses the owner-authorized memory-only mechanism.

Update 2026-09-18: owner-authorized memory-only qualification now passes actual
gameplay timing and production Quick Practice/drill/capture. Browser audio is
supplied as local Response bytes before native fetch; contexts are offline and
escaped media requests fail closed. This is not the rejected binary HTTP bypass.
120 gameplay events across four rates give p95 10.18/10.97/10.36/20.71 ms, maximum
22.75 ms. Pause/seek/resume/restart/exit pass without duplicates or page errors.
Production capture preserves both tracks across routes and ends them on stop;
mute/pause captured RMS is zero. Desktop/mobile Chinese controls were inspected,
and a 15-second actual gameplay audio recording was created. Six real browser
venue renders pass with 54 in-memory sample loads and no media requests. Cache,
remaining browser matrix, matched A/B and owner listening gates are still open.

The [requirement audit](audio-acceptance-audit-2026-09-17.md) maps the original
scope to evidence and remaining gates. No completion or owner acceptance is claimed.

Browser/media testing is paused at the owner's request following repeated IDM
popups. All active task tests/downloads and local test servers were stopped.
Do not retry browser media or downloads without explicit reauthorization. The
gameplay timing harness has no passing result; production/drill/offline/recording
and Firefox acceptance remain unverified. Earlier fixture-backed results below
remain limited to the explicitly named checks.

The [approved execution goal](../research/audio-system-goal-2026-09-17.md) and
[research/acceptance plan](../research/audio-system-plan-2026-09-17.md) retain the
full requirements. PROGRESS.md records resumable implementation state.

## Baseline and first stage

Baseline release check: 685 tests across 66 files, no failures/skips; TypeScript,
Vite and active motion/cache guard passed. Tests/workers ran on bundled Node
24.19.0. Initial dependency installation through the system npm wrapper used
Node 25, so installation was repeated through the explicit Node 24 executable.

The prepared palette contains 15 files / 552169 audio bytes (539.23 KiB), below
the 6 MiB ceiling. Contacts are mono PCM WAV from one CC0 recorded take, trimmed
to remove approximately 478 ms of leading silence and processed into three tonal
variants. Bounces are procedural hard/clay/grass transients; crowd murmur and
two applause variants are recorded sources delivered as MP3. Provenance includes
lossy preview limitations; no claim of multiple independent contact recordings.

Seven new tests pass for file inventory/hashes/budget, PCM attack/clipping/tail,
provenance, all six venue/three audience settings, surface decay, deterministic
environmental loops and audio-only variation. Existing tests are unchanged.

## Graph-stage evidence

Real Edge 153 OfflineAudioContext
renders pass for all six profiles, wet master mute (zero energy after fade),
32-voice stress (peak .8457), two-convolver transition bound and zero resources
after reset/dispose. The complete decoded palette plus generated ambience uses
9514064 bytes. A real 404 causes an explicit failure state and retry recovers.

These checks use explicitly labeled local-byte fixtures: normal browser WAV/MP3
requests currently return empty HTTP 204 while direct clients retrieve valid
files. A running IDM instance may be intercepting media; cause is not confirmed.
No global settings were changed. The script defaults to normal HTTP; fixture mode
must be explicitly selected with AUDIO_LOCAL_FIXTURES=1 and is not delivery proof.

## Integrated gameplay and remaining verification

Live playback now uses the shared graph/palette and clock/camera adapter. Quick
Practice and drill start unlock on the user gesture. Bilingual controls provide
master mute, ambience, crowd mute/level and visible retry. Pause/seek/backgrounding
fade voices; exit clears resources without closing a leased capture track. Only
session completion triggers applause. Physics and simulation clocks are unchanged.

Live graph/capture checks cover all 18 venue/audience combinations, zero captured
RMS on mute/pause, audible resume, track continuity across exit, idempotent release,
ten enter/exit cycles and bounded completion cleanup. Idle voices, convolvers,
decoded bytes, loops and timers return to zero. Capture pipe warmup was 540 ms;
this is separate from event dispatch timing.

Actual development Quick Practice verified visible failure/Retry recovery,
English/Chinese desktop controls, crowd mute, global mute and exit cleanup with
no page errors. Integration release passes 697 tests / 69 files, no failures/skips,
plus TypeScript, production build and motion/cache guard. Bounded audio caching
is implemented; normal HTTP/offline qualification, production gameplay/drill
capture, 100-event timing and review recordings remain.

Owner audition and real Safari/iOS checks remain open. Source descriptions and
waveform checks are not evidence of subjective listening quality.

## Local failure-path checks after browser testing stopped

Six additional AudioPalette tests exercise load coalescing/cache reuse, empty
204 responses, same-size integrity corruption, decoder rejection and retry,
late decode completion after exit, and eight-second timeout cleanup. All transport
and decoder inputs are local test doubles; no browser or network runs. The combined
audio suite passes 18 tests / 4 files with no skips, and TypeScript build checking
passes under Node 24.19.0. The previous 697-test release result predates these six
additive tests; it is not relabeled as a new full-suite run.

These tests prove control-flow/error handling only. They do not establish real
codec support, audible realism, playback timing, normal HTTP or offline caching.

Final local release rerun at 67d6f4e: 703 tests / 70 files passed with no failures
or skips (195.05 seconds for tests); TypeScript, Vite production build and the active
motion/cache guard passed. The existing large-bundle warning remains. No browser
or media download was launched. This closes local regression qualification but
does not close the browser-dependent gates listed in the acceptance audit.
