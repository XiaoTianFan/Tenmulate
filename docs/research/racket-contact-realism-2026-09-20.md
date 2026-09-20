# Racket-contact realism: audit and next implementation

Date: 2026-09-20. Research/design result; no replacement audio has been auditioned
or accepted, and this document does not change the current runtime sound.

Owner feedback: the racket contact sounds **too artificial or electronic**.
Prioritize natural dry transients and suppression of synthetic tonal ringing;
louder output or more reverb alone does not meet this request.

## Current implementation and limits

- `scripts/audio/build-palette.mjs` trims one CC0 racket hit from an HQ MP3 preview
  to about 304 ms. All three contact files come from that same take, with +/-2.5%
  sample-rate changes and 6–7.6 kHz low-pass filtering. They are not independent
  recordings. Filtering may soften the attack; this needs an equal-level audition.
- `AudioPalette.contact` uses the decoded recording when available. Otherwise it
  generates filtered noise with 290 Hz and 1170 Hz tones. Loading/fallback state
  matters: the owner may hear this fallback if media requests are intercepted.
  Do not infer the owner's current path without checking it.
- `PracticeAudio.playCue` uses outgoing speed principally as a gain scalar, capped
  at 140 km/h. Stroke family and spin do not select a distinct impact character.
  `cueVariation` adds further +/-2.5% playback-rate variation without preventing
  consecutive sample repeats. Thus several different shots retain one sonic identity.
- Bounces use authored rubber-body/noise synthesis; crowd is recorded; weather,
  room tone and venue impulse responses are generated. The shared Web Audio graph,
  bounded voices, gesture unlock, master/capture routing and authoritative timing
  are suitable foundations to retain.

## Recommended direction: recorded attacks with restrained physical variation

1. Build a small bank of genuinely independent racket contacts. Initial target:
   12 clean takes covering soft/medium/hard contact, with four alternatives each.
   Use separate serve/slice/volley categories only where both recordings and runtime
   shot metadata support them. A renamed or pitch-shifted take does not count.
2. Keep the source attack intact. Trim silence precisely, remove DC/low rumble,
   avoid aggressive denoising, retain a short natural decay, and reject recordings
   with speech, fence hits, clipped transients or inseparable background noise.
   Do not claim MP3 converted to WAV restores lost detail.
3. Select by shot family and contact intensity, then choose an alternative while
   avoiding the last two takes in that group. Outgoing ball speed can be an explicitly
   approximate intensity input until relative racket/ball velocity is available.
   Do not fabricate sweet-spot errors or off-center hits absent from the simulation.
4. Make intensity affect the attack/body balance and decay, not just volume.
   Keep pitch changes small (initial tuning range around +/-0.5–1%). Use two-layer
   crossfades only if listening confirms no flamming/comb filtering; otherwise use
   discrete take selection with smoothly varying gain/filtering.
5. Improve synthesis as a separate fallback: a short compression transient driving
   damped frame and string-bed resonances, with independent excitation, frequency,
   decay and spectral-noise envelopes. Calibrate against clean recordings. Do not
   simply add more sine waves or a louder click to the present sample.
6. Apply venue reflections after the dry contact. Tune near/far spectral attenuation
   separately from the core impact. Avoid baking indoor echo into every sample or
   lengthening reverb to hide a weak attack. Preserve the visual contact clock.

## Verified source shortlist (not an audition endorsement)

- Jamesdrake89, [Tennis pack](https://freesound.org/people/jamesdrake89/packs/37011/):
  separate forehand, serve and slice recordings. Individual
  [Serve 1](https://freesound.org/people/jamesdrake89/sounds/662265/) and
  [Slice 1](https://freesound.org/people/jamesdrake89/sounds/662270/) pages specify
  CC0, mono 48 kHz/24-bit WAV. The author explicitly notes wind/traffic underneath.
  These are candidates for isolated impact extraction, not ready-made dry assets.
  Original download requires login; public preview quality must be labeled honestly.
- Itsadrizzit, [tennis_serves.wav](https://freesound.org/people/itsadrizzit/sounds/439340/):
  CC0, multiple serves, 44.1 kHz/16-bit stereo. Background cicadas, nearby matches,
  aircraft and a final fence hit are disclosed. Lower priority for a clean core bank.
- Current [kletton97 source](https://freesound.org/people/kletton97/sounds/710041/):
  retain as baseline, not the only sound identity.

[Daniel Russell's experimental modal analysis](https://www.acs.psu.edu/drussell/Demos/tennis/tennis-1.html)
identifies distinct frame and string-bed modes; it supports separating those
components in synthesis. Its measured frequencies describe one racket, not universal
constants. Use it as research, not as a reusable sound-asset license.

## Web delivery and acceptance

Use short mono 48 kHz PCM WAV impacts decoded once into reusable AudioBuffers.
Twelve 0.4 s, 16-bit mono takes total about 461 kB before headers. Preserve the
6 MiB total transfer and 32 MiB decoded-memory limits, hashed assets, provenance,
load cancellation and post-master capture. Do no synthesis or decoding per animation
frame. Keep shot-selection randomness independent of physics and seeded replay.

Before replacing the current sound, compare: current recorded path, current
procedural fallback, proposed independent samples, and the revised fallback.
Render the same event sequence at matched perceived loudness, first dry, then in
open court and indoor hall, including soft volleys and hard serves. Explicitly
identify which path each clip uses. Owner listening must decide whether contact
actually sounds more like tennis; waveform and test passes cannot establish that.

Verify no delayed attacks, no repeated-take machine-gun pattern, no accidental
extra impacts at preview loops, no clipping or phasey layer transitions, and intact
pause/mute/capture behavior. Browser QA must use the existing offline/RAM transport
with zero native media HTTP; do not revisit renamed binary URLs or IDM settings.
If ordinary sample loading is unreliable on this host, qualify an in-memory decoded
contact fallback before judging the new sound; do not silently review the old synth.
