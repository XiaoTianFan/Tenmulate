# Goal text: venue-aware tennis audio

Proposed for owner review and manual launch. Implementation has not started.

```text
Refactor Tenmulate audio into a realistic, venue-aware tennis soundscape.
Start only on the owner's manual launch. Read AGENTS.md and docs/research/audio-system-plan-2026-09-17.md. Resume from PROGRESS.md; update each stage. Put unresolved items in BLOCKED.md; continue independent work. Timing/licensing > realism > breadth.

1. Defaults proposed for owner review
Assumed: subtle ambience enabled after Start; crowd follows empty/half/full with its own mute/level; no music, speech or invented scoring. Native Web Audio; sampled impacts/crowd plus synthesized wind, room tone and reverb. Owner listening acceptance remains separate.

2. Boundaries
Only change src/engine/audio/**, audio integration in src/components/**, src/hooks/**, src/app/**, src/domain/**, src/i18n/** and src/styles/**; new audio content in src/content/, public/assets/audio/**, scripts/audio/**; additive audio tests/tools; audio cache rules in vite.config.ts; relevant docs, PROGRESS.md, BLOCKED.md. Other files read-only. Preserve physics, compiled timeline, motion assets, sibling laboratory, capture contract ADR-0034 and unrelated edits. Preserve tests/assertions and CI. No new runtime dependency, paid service, account, deployment or push. Add a new ADR.

3. Baseline before implementation
Observed 2026-09-17 at e78d086: clean tree, six venues, three surfaces, oscillator impacts, 74 Hz ambience, shared capture output; dependencies absent and shell Node v25.2.1. Test totals UNVERIFIED.
Task 0: verify current state; locate Node 24, then validate/run npm ci and npm run check:release. Commands inspected, not run during planning. Record passes/failures/skips and build; investigate drift before dependent edits. Write a <=10-line execution receipt.

4. Implement in focused committed stages
A. Acquire/audition dry racket, bounce and crowd material; prefer CC0, permit verified CC BY with notices. Candidates require verification; no broadcasts or login bypass. If unsuitable/unavailable, author synthesis and label it honestly. Record source/license, author, date, edits, hashes and recipe. Ship compact mono PCM WAV impacts, compressed stereo ambience (MP3 baseline; Opus optional only with proven fallback). No runtime third-party fetch.
B. Build one gesture-unlocked AudioContext with impact, training-cue, ambience and crowd buses, venue effects and one master feeding speakers/capture. Reuse decoded buffers; bounded voices/cache, cancellation, fade transitions, true zero mute, recoverable load/unlock errors. Budget <=6 MiB shipped audio, <=32 MiB live decoded buffers, <=32 voices, <=2 convolvers during transitions.
C. Map all six venues: outdoor sparse reflections, indoor denser damped tails, surface-aware bounces and restrained velocity/seed variation. Derive positions/events from existing sessions; preserve near/far clarity. Crowd silent when empty, quieter during rallies, cheers only at supported point/session endings. Preserve countdown/footwork cues. Respect pause/seek/restart/rate/visibility/exit without duplicate or stale sounds. Keep impacts tied to the authoritative clock, including zero.
D. Integrate bilingual controls, bounded offline caching, provenance and architecture/status docs. Verify actual Quick Practice and drill playback and capture.

5. Verification discipline
Follow the plan's browser/DSP matrix; use real OfflineAudioContext renders. Inject a missing asset to prove visible recovery; restore and retest. No skipped/deleted tests, weaker assertions, fake outputs or failure suppression. After three identical failures change approach; revert only regressive owned edits.

6. Completion
Require release checks with no new failures/skips, audio budgets and lifecycle/event tests passing, and actual-browser audible/capture evidence. Report unavailable devices and owner listening as OPEN.
Require local commits, docs, PROGRESS.md, BLOCKED.md (None if empty), and red-to-green results. Never equate local implementation with merge, deployment or owner acceptance.
```
