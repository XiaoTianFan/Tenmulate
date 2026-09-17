# Venue-aware audio implementation

Status: In progress, local only. Last updated: 2026-09-17.

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
