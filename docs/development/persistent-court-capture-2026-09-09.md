# Persistent court capture verification — 2026-09-09

Status: Local capture implemented and browser-verified. Website-initiated casting
to the existing receivers is **not implemented**. Physical iOS/receiver acceptance
and public deployment have not occurred.

Implementation stage: `2404a64`, followed by a focused fix making the audio checkbox
reflect the active capture session after route changes. The governing contract is
[ADR-0034](../decisions/0034-persistent-court-capture.md).

## User workflow

Open **Cast** from setup, the drill library/editor, or rehearsal controls. **Start
local capture** creates a court video stream, optionally with practice audio.
Close the panel and configure or practice normally. Reopening the panel attaches
a muted preview to that same stream. **Stop local capture** releases its tracks.
The canvas remains mounted whether or not capture is active.

The separate iOS guide describes Control Center → Screen Mirroring → the existing
receiver. That mirrors the device display and does not consume the local capture
stream. The website cannot trigger this picker or verify the receiver connection.
Do not interpret “Local capture active” as “TV connected.”

## Automated validation

- Full suite: **369 tests in 38 files passed** at the implementation stage.
- Final audio-indicator adjustment: **13 capture tests passed**, TypeScript and
  production build passed again. Tests cover stable source identity, idempotent
  start/stop, video-only capture, cancelled/pending audio acquisition, late-result
  cleanup, unsupported/security failures, track mute/end, context loss/recovery,
  source teardown and portrait/landscape resolution budgets.
- Production build and motion/cache guard passed: 25 motion clips, the existing
  opponent bundle remains the only precached opponent GLB. No motion assets changed.
- Vite continues to report the large-chunk warning; it is not a build failure.

## Rendered browser evidence

Browser plugin not available; used bundled Playwright with installed Edge
**152.0.4191.66**. Development URL: `http://127.0.0.1:4173/`. Production preview:
`http://127.0.0.1:4174/`. These are local review servers, not iPhone-accessible LAN
deployment URLs.

| Flow | Evidence |
| --- | --- |
| Quick Practice setup → changed camera → practice → setup | Same canvas object, scene instance, MediaStream and video/audio track objects; one canvas in the document |
| Editor setup → Test drill → editor | Same source/track identities; decoded court frames present |
| Drill library → Run drill | Library parks the connected canvas and keeps tracks live; gameplay resumes on the same source |
| Rehearsal fullscreen → capture panel | Native dialog remains usable; same source and decoded court frames |
| Desktop 1440×900 → portrait 320×740 | Stream survives resize; source stays within the rotated 1280×720 envelope |
| Practice audio | Existing production contact cue detected in the captured audio stream; measured sample peak approximately 0.117 |
| Close preview → reopen | Video element is removed while closed; capture identity persists |
| Stop → video-only restart | Previous tracks end; a new stream contains video only |
| Unsupported capture API | Start disabled; native mirroring guidance remains available |

Frame validation read pixels from a **test-only** 64×36 sample of the decoded video,
not the source canvas. All active route samples were nonblack and nonuniform; a
camera preset change changed captured pixels. Runtime capture uses no pixel reads.
This proves frame delivery at the sampled transitions, not a zero-dropped-frame
guarantee. Observed sources included 798×720 setup, 1152×720 rehearsal and 320×740
portrait. The retained library scene intentionally produces no new frames.

Phone layout review covered 320×740 and production touch emulation at
390×844, DPR 3. All five rehearsal header buttons fit the 320 px viewport.
Production touch flow used the real reveal-then-tap controls, reached a live
585×1266 preview and retained source identity through setup/playback. Both audio
and video-only starts were exercised; the final video-only run confirmed that
the disabled audio checkbox stays unchecked after navigation. No browser console
errors, page exceptions or framework overlays were observed.

Temporary scripts, JSON readbacks and screenshots are under
`C:/Users/20378/AppData/Local/Temp/tenmulate-capture-qa*`; they are review evidence,
not application dependencies. Desktop, phone controls, guide and preview screenshots
were visually inspected. React performance review kept controller ownership outside
routes, avoided frame-driven React state, and removed the preview consumer when closed.

## Outstanding receiver and device gates

The current WebKit MediaStream player has no compatible wireless playback path;
[ADR-0034](../decisions/0034-persistent-court-capture.md) records the primary-source
evidence. No receiver discovery, SDK transport, HLS endpoint, native helper or
cloud media relay is present. Native Screen Mirroring remains a labeled fallback,
not completion of the original website-initiated casting requirement.

Chromium touch/viewport emulation does not exercise iOS WebKit, AirPlay, actual
receiver video/audio, route-switch interruptions, sustained phone thermals or
end-to-end latency. Those remain untested. No iPhone, Sony, Lebo or Qiyiguo playback
success is claimed.
