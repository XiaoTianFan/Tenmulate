# ADR-0057: Venue-aware practice audio

- Date: 2026-09-17
- Status: Implemented locally; full browser delivery and owner listening gates open
- Qualification update 2026-09-18: owner-authorized memory-only tests cover actual
  gameplay timing, production capture, Workbox cache policy and Firefox sample
  decoding/fades. Normal HTTP through IDM is not used. Owner listening and real
  Safari/iOS remain open; see the updated implementation ledger.
- Extends: ADR-0015 (compiled gameplay clock) and ADR-0034 (shared court capture)

## Decision

Use native Web Audio with one route-independent AudioContext and one post-effects
master output feeding both speakers and optional court-capture destinations.
Rehearsal owns voices and decoded scene buffers; capture owns only its output tap
and tracks. Exiting practice fades sound, cancels loads, releases buffers and
effects, but does not replace a live capture track or close the shared context.

Recorded CC0 racket transients, audience murmur and applause combine with authored
surface-bounce transients, environmental noise layers and generated stereo impulse
responses. The six existing venue IDs select explicit artistic acoustic profiles;
the selected surface independently controls bounce timbre. Crowd density follows
the existing audience occupancy. Empty crowds are silent. Murmur is reduced during
rallies and applause occurs only on session completion; no scoring is inferred.
Countdown and footwork remain recognizable, dry training cues.

The audio adapter reads physical contact/bounce metadata and observes the existing
capped simulation clock. It does not alter simulation timing or schedule sounds
against a separate continuously advancing wall clock. Exact-zero openings play
once. Pause, seek, restart, backgrounding and session replacement clear stale
sounds. Audio variation uses an independent deterministic hash, not physics RNG.
Stereo placement follows the session camera convention with bounded attenuation.

The graph caps sources at 32, retains at most two convolvers during transitions
and applies headroom/soft saturation before master mute. All outputs share mute.
The palette verifies byte lengths and SHA-256 before decoding, coalesces requests,
serializes decodes, ignores stale generations, and bounds decoded buffers with
room for impulse responses. Fetches time out after eight seconds. Failed loads
show a translated status with retry; procedural impacts are explicitly identified.
Gameplay does not wait indefinitely for optional audio.

Firefox versions without AudioParam.cancelAndHoldAtTime use a sampled-current-value
cancelScheduledValues/setValueAtTime fallback before the same linear fade. A real
Firefox 136 failure and successful six-profile mute rerun qualify this branch.

Short impacts ship as mono 48 kHz/16-bit PCM WAV; audience audio ships as MP3 with
gapless metadata. Content-hashed audio URLs use a dedicated bounded CacheFirst
runtime cache (20 entries, 30 days, only status 200). No audio service, credentials,
runtime dependency or third-party runtime fetch is introduced. Asset sources,
licenses, transformations and hashes are retained in shipped provenance.

## Consequences and verification

The initial mix enables subtle ambience after a user gesture. Crowd has a separate
toggle/level and global mute affects everything, including reverberant tails and
capture. Starting drills unlocks audio before asynchronous session compilation.

Pure tests preserve existing cue expectations and validate profile coverage,
source inventory, budgets and clock behavior. Real OfflineAudioContext rendering
checks decay, silence and saturation. Live AudioContext/capture tests check all
18 venue/audience combinations, pause/resume, repeated exit/reentry and lease
release. These do not substitute for actual gameplay checks or listening review.

Normal browser media HTTP requests on the development host currently return empty
204 responses although direct HTTP clients retrieve correct files. IDM may be
intercepting them, but this is not established. Local-byte fixtures explicitly
isolate DSP checks from this unresolved transport problem. They do not establish
offline cache success, normal network delivery, device audio quality or owner
acceptance. See the [implementation ledger](../development/audio-system.md).
