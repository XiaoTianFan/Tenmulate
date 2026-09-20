# Audio listening review

Technical checks pass independently of subjective acceptance. Owner listening
remains OPEN. These local review artifacts are generated under ignored
`tmp/audio-review/`; they are not shipped or committed runtime assets.

| Local file | What it contains |
| --- | --- |
| production-quick-practice.webm | Actual 15-second production Quick Practice capture, at application levels; stereo Opus, 48 kHz. Peak -20.7 dBFS; mean -49.3 dBFS includes quiet intervals |
| baseline.wav | Baseline oscillator/hum recipe from e78d086 on observed gameplay event times |
| hard-open-arena.wav | Current recorded/synthesized palette and outdoor profile on the same events |
| timber-hall.wav | Current palette and indoor profile on the same events |
| comparison.json | Exact event timestamps, level normalization, peak values and rendering method |

The three WAVs are real OfflineAudioContext renders, not live captures. They use
the same observed 1× gameplay contact/bounce times, hard surface, centered impacts
and standardized impact levels. The current renders include full-crowd rally
murmur and the default ambience level. Each is normalized to -30 dBFS RMS; peaks
remain below .61. This makes the timbre/room comparison fairer than comparing raw
loudness. The unnormalized production capture preserves actual camera attenuation,
variation and current application mix.

Listen for believable contact attacks, sufficiently distinct surface bounces,
indoor decay without exaggerated repeats, unobtrusive crowd/ambience and loop
seams or clicks. The initial palette has one recorded racket take with three
processed variants, procedural bounces, and recorded crowd layers; it does not
claim three independent racket recordings or measured building acoustics.

Reproduction: run `verify-memory-dsp.mjs`, `verify-gameplay.mjs`,
`verify-memory-production.mjs`, then `render-listening-comparison.mjs` using Node
24 and the existing Playwright installation via AUDIO_PLAYWRIGHT_MODULE. The
gameplay verifier requires AUDIO_BROWSER_TESTS=explicitly-authorized. All media
delivery is in memory; do not restore HTTP media or renamed binary URLs.

## Owner acceptance — 2026-09-20

The owner confirmed satisfaction with the latest recorded-contact upgrade and
configuration UI, and requested commit/merge into local main. This closes the
owner listening gate for this version. Earlier pending entries are historical.
