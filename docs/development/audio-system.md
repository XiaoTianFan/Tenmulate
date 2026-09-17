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

## Remaining verification

Live playback still uses the old engine. Graph ownership, lifecycle, bilingual
controls, offline caching, true master mute, capture parity, OfflineAudioContext
renders, timing/resource budgets and actual browser gameplay are the next stages.
Owner audition and real Safari/iOS checks remain open. Source descriptions and
waveform checks are not evidence of subjective listening quality.
