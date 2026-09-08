# Interval-first rhythm and arrival continuity — 2026-09-08

Implementation follows [ADR-0029](../decisions/0029-interval-first-motion.md). The
first divergent stage was runtime scheduling/blending, not the source motion:
the old compiler fixed stroke speed and extended the interval; travel could raise
its own rate without reporting it. Braking blended toward one frozen prepared frame
and reserved another 180 ms before stroke entry. Both behaviors are replaced without
changing the active 25-clip GLB or laboratory metadata.

## Verified behavior

- The reproduced 70 km/h groundstroke setup, 3.00 s interval, 150% preferred stroke
  and movement, now resolves its first pair to about **164% stroke / 207% movement**
  with exactly **3.00 s** between contacts. Later alternating steps resolve rates
  individually while retaining the interval. A 1 s request reports about **2.23 s**
  at the bounded ceiling for the tested setup; it does not teleport to meet 1 s.
- Tests cover 3 s groundstroke, serve, volley and overhead intervals, long-interval
  preference retention, deterministic trajectory identity, impossible interval
  reporting and continuous preview batch joins over 60 s/backward seeks.
- Actual loaded-rig tests cover both hands, drives/slices/volleys through prepared
  entry and 50/100/150/225/300% rates. Entry source time advances monotonically;
  body-relative racket displacement rejects the old frozen frame. Existing coil,
  submillimeter boundary continuity, rigid-grip and contact tolerances remain.
- All nine stroke variants preserve after-IK contacts at rates from 50 to 300%,
  including both normal/compact serves and the overhead proxy. The active bundle
  remains `tennis-local-v1.64f3bc37161d.glb` with SHA-256
  `64f3bc37161dfc2fcf536e80a6e39465792bdc6a822dd26493d04d2ab2bd3eaf`.
- Browser sampling of all 16 bundled drills finds no arrival dwell, with peak root
  speed at most 4.005 m/s in those scenarios and actual racket contact error below
  the 2 mm contract tolerance. Broader automated speed/acceleration and camera-boundary checks also pass.
  A 173-frame, 30 fps actual-gameplay recording and arrival filmstrip show the
  movement, advancing preparation, contact and follow-through at normal clock speed.
- Production UI checks cover both preference ranges, exact/limited interval messages,
  per-shot editor overrides, resolved playback values, reload persistence and the
  390 px layout. Practice → Editor → Test drill retains the same scene instance.
  Ball-only highlighting and the absence of blur controls are preserved.

## Checks and scope

The cumulative suite passes **324 tests / 33 files**. The subsequent nine-variant
expanded-rate contact check passes all 54 motion tests. Production/PWA build,
`check:motion`, and the active-bundle precache guard pass. The existing large-chunk
build advisory remains. Earlier raw-motion tests depended on an implicit playback
speed increase; they now explicitly use the gameplay solver, retaining root-speed,
travel-facing shoulders, foot-placement and deterministic-seek assertions.

Six-shot browser compilation across the 16 drills measured approximately 31–292 ms
including existing physics and return fitting. This is bounded local timing, not
a device-performance benchmark. Search occurs at compilation/batch preparation;
per-frame rendering samples the resolved clock. Transactional zone gestures still
commit only once on release. Owner technique/thermal acceptance and public deployment
remain separate from these local checks.

The Browser plugin was unavailable; regular Playwright used the temporary source
harness on 4186 and the existing production preview on 5173. Local scripts/results:
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/interval-motion-net/`
(`motion-qa.mjs`, `motion-result.json`, `practice-transition.mp4`,
`arrival-filmstrip.png`, `ui-qa.mjs`, `ui-result.json`). The source harness is temporary;
the user's normal preview is rebuilt and refreshed with saved settings retained.
