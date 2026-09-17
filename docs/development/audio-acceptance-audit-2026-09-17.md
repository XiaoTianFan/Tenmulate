# Audio acceptance audit — 2026-09-17

## Updated qualification — 2026-09-18

The owner authorized another testing mechanism. Renamed binary HTTP failed and
was removed. Media is now supplied through local Response bytes/worker messages,
never native fetch. Offline contexts and media request auditing enforce this.
The following evidence supersedes the historical missing-evidence table below.

| Gate | New evidence |
| --- | --- |
| Gameplay timing | 120 actual contacts/bounces, 30 per 0.5/0.75/1/1.25 rate; p95 10.18/10.97/10.36/20.71 ms, max 22.75 ms; base/output latency separately .01/.04 s |
| Playback actions | Actual Quick Practice pause, both seek directions, resume, restart and exit pass without duplicates; actual drill dispatch and controlled visibility-event pause/resume/cleanup pass |
| Production/capture | Built Quick Practice and drill playback pass; nonzero capture, mute/pause RMS zero; audio/video IDs survive routes, stop ends tracks; no page errors |
| Bilingual/mobile | Desktop and 390x844 Chinese settings inspected; crowd toggle disables its slider; audio-specific Chinese contact/bounce labels corrected |
| Cache/offline policy | Actual registered production Workbox strategy in a real worker: 15 warm entries, 15 byte-identical offline hits without sample delivery, 15 cold missing responses not cached, recovery restores all 15; zero browser/server media requests |
| Pending-load lifecycle | 18 rapid venue/surface switches with delayed in-memory responses; cancelled generations leave zero buffers/pending work; next scene recovers; exit resources return to zero |
| Engine budgets/recovery | Original broad DSP/capture verifier rerun with memory-only audio: six profiles, 18 audience states, stress limits, mute tails, ten cycles, completion cleanup, missing Response and retry pass |
| Firefox | Installed Firefox 136 decodes and renders all six venues. Missing cancelAndHoldAtTime caused a real failure; compatible ramp fallback fixes it. Audible initial output and zero after mute pass. Its missing offline suspend is handled with an actual initial 40 ms fade test |
| Listening artifacts | Actual 15-second production capture; paired -30 dBFS RMS baseline/outdoor/indoor renders use the same observed gameplay events and disclosed standardized gains. Review material is not owner acceptance |
| Final local release | Node 24 check:release exits 0: 704 tests / 71 files, no failures/skips; TypeScript, Vite build, motion/cache guard pass. Corrected production labels/capture and rebuilt worker cache policy rechecked successfully |

Owner listening, physical output latency and real Safari/iOS remain OPEN as
permitted by the goal. Normal media HTTP through this host's IDM is unqualified;
the authorized alternative verifies decoding, playback, capture and cache policy.
No merge, push, public deployment or IDM setting change occurred.

## Historical pre-bypass audit

| Requirement | Current evidence | Remaining gate |
| --- | --- | --- |
| Node 24 baseline and receipt | PROGRESS.md; baseline 685 tests / 66 files; build/motion guard passed | None for baseline |
| Focused scope and commits | Commits 03648e9, c641e2b, f57fc55, 4274f83, 67d6f4e; diff leaves physics, clock implementation and motion assets unchanged | No merge/push/deployment claimed |
| Licensed compact palette and repeatable recipe | Shipped provenance/NOTICE, asset attribution, builder, hash/inventory tests; 15 files, 552169 bytes | Subjective source audition remains open; one contact take has three processed variants |
| Web-native formats/no runtime service | Mono PCM WAV impacts, MP3 crowds, native Web Audio, local hashed URLs; unchanged runtime dependencies | Real browser codec matrix incomplete |
| Six venues/surfaces/audience/environment | Explicit profiles, pure tests, prior Edge OfflineAudioContext renders and 18 live venue/audience configurations | Actual gameplay listening across venues, weather, surface overrides and crowd levels |
| Memory/voice/effect budgets | Prior fixture-backed browser reports: palette plus environment 9514064 bytes; graph separately counts impulses; 32 voices, two convolvers; 80-hit stress peak .8457 | Device/browser qualification remains limited to tested host |
| Single unlocked context/shared capture output | PracticeAudio owner and drill-start gesture integration; prior live capture tap survives exit, release ends track; zero captured RMS on pause/mute | Production drill and actual court-capture playback evidence incomplete |
| Lifecycle and failure recovery | Prior ten live engine cycles return resources to zero; completion cleanup passes; 404 then retry recovers; six local ownership/error tests pass | Actual UI seek/restart/visibility/rate sequence and rapid pending-load venue changes not fully qualified |
| Clock timing and spatial cues | Pure exact-zero/seek/rate/camera tests; short development gameplay dispatch observations | At least 100 actual contact/bounce measurements and p95 <=40 ms across rates not established; timing harness has no passing result |
| Bilingual settings/status | Development Quick Practice English/Chinese desktop controls inspected; visible failure/retry observed; crowd/master controls exercised | Mobile/device review and production drill UI not complete |
| Bounded offline caching | Dedicated hashed CacheFirst rule, 20 entries/30 days/status 200; build keeps motion precache guard | Normal HTTP, warm offline success and cold offline recovery unverified |
| Real acoustic evidence | Saved prior Edge 153/Windows 10 real OfflineAudioContext and live capture results; explicitly supplied local media bytes | Fixtures are not normal delivery proof, physical listening or transport verification |
| Browser/device matrix and review recordings | Edge fixture-backed DSP and development UI evidence; normal Edge/Chromium media returned empty 204s | Firefox run/download stopped; real Safari/iOS unavailable; matched gameplay A/B recordings not produced; owner acceptance open |
| Documentation and delivery | ADR-0057, architecture, user guide, attribution, audio ledger, PROGRESS.md and BLOCKED.md committed | Full acceptance remains incomplete |
| Final release regression | Node 24 check:release at 67d6f4e: 703 tests / 70 files, no failures/skips; TypeScript/build/motion-cache guard pass; existing bundle warning | None for local regression; this is not browser acceptance |

The remaining acceptance evidence cannot be replaced by more pure tests, source
inspection or fabricated recordings. No browser/media workaround, IDM setting
change or new download is authorized. Resume browser qualification only after an
explicit owner instruction permits it; retain the full original goal and budgets.
