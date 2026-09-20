# Open audio acceptance items

## Current — 2026-09-18

The owner-authorized memory-only mechanism has closed the technical playback,
capture, timing, codec, cache-policy and lifecycle gaps below. It never sends
audio through browser HTTP; the renamed-binary attempt remains rejected.
See the updated requirement audit and PROGRESS.md for measured evidence.

Open exceptions: owner listening/realism review and real Safari/iOS device checks.
Ordinary media HTTP through this host's IDM is not qualified; testing uses the
authorized alternative. Do not retry HTTP media or modify IDM settings.
Final local release and production label recheck passed. Technical implementation
blockers: None. The owner/device exceptions above remain open by design; no merge
or public deployment is included in this local goal.

## Historical blockers and failed approaches

- Failed bypass, owner-confirmed: after permission to try a different testing mechanism, the binary HTTP transport still triggered IDM (`/__audio_payload__/contact-0.…wav.bin`, screenshot supplied by owner). Extension/MIME rewriting does NOT isolate IDM. Retracted the claim that the successful decode probe established safety. Stopped all test processes/servers, including task-specific Firefox profiles; verified no listeners on 4187/4188/4189/9234. Removed the uncommitted failed transport experiments. Do not send audio bytes through browser HTTP again; any future test mechanism must supply bytes entirely in memory without browser media network requests.

- OWNER CONSTRAINT, 2026-09-17: repeated browser/download attempts triggered many Internet Download Manager popups. Stop all browser media requests and downloads for this task unless the owner explicitly reauthorizes them. Do not change IDM settings or retry through another browser/transport. Running timing test, Firefox tooling download, development server and preview server were stopped. No task-owned headless Edge process remained in the subsequent process check.
- Browser acceptance is incomplete: the 100-event gameplay timing run did not pass; production/drill/offline/recordings/Firefox checks remain unverified. The first timing harness returned no measured events, so its assertion failed; a revised run was interrupted at the owner's request. No success is inferred. Browser scripts now fail before launching unless explicitly authorized.

- Owner listening acceptance is OPEN; no audition or physical-speaker quality is claimed.
- Real Safari/iOS/device qualification is OPEN until an actual device is available.
- Core implementation is committed. Full acceptance is blocked by the restriction on further browser/media testing; the [requirement audit](docs/development/audio-acceptance-audit-2026-09-17.md) records the missing evidence.
- Palette source/license and numerical checks are complete; audible audition and gameplay A/B review remain OPEN.
- Earlier normal browser audio transport checks returned empty HTTP 204 for local WAV/MP3 in Edge and Chromium; direct clients received correct bytes. The cause was not established. The owner's later stop instruction supersedes the earlier request to exclude localhost. No global setting was changed. Fixture-backed DSP does not establish transport success. Do not resume this investigation without explicit owner reauthorization.
