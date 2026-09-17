# Audio acceptance audit — 2026-09-17

Status: incomplete, local implementation only. The owner stopped browser media
requests/downloads after IDM popups. This audit does not authorize their resumption.

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
