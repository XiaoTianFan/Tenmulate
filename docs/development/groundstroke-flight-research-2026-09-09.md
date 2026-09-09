# Neutral groundstroke research and verification — 2026-09-09

## Question and evidence

The reported warm-up/feed ball is a useful reference: low, controlled and deep
does not imply a heavy-topspin professional drive. Investigate spin, contact and
bounce geometry, and the distinction between launch speed and flight speed before
changing pace or the force model. The screenshots alone cannot establish the
launch speed of a real feed.

Primary sources reviewed:

- [Cross, Ball Trajectories, chapter 42](https://www.physics.usyd.edu.au/~cross/TRAJECTORIES/42.%20Ball%20Trajectories.pdf):
  numerical trajectories, drag, lift and spin; Figure 42.3 compares zero spin with
  topspin for the same launch speed and landing distance.
- [Cross and Lindsey, free-flight aerodynamic measurements](https://twu.tennis-warehouse.com/learning_center/aerodynamics2.php):
  drag/lift force equations and measured coefficients. Their 128-shot sample has
  mean drag coefficient 0.507 with standard deviation 0.024; it does not support
  eliminating air resistance to manufacture an easy deep ball.
- [Cross, trajectory experiments](https://www.physics.usyd.edu.au/~cross/TRAJECTORIES/Trajectories.htm):
  backspin provides upward lift and increases carry; topspin curves the ball down.
- [Tennis Warehouse University, trajectory inputs](https://twu.tennis-warehouse.com/learning_center/trajectory_info.php):
  incoming spin and racket interaction can produce different outgoing spin signs.
  A hand/racket feed should not automatically be modeled as a topspin drive.

Low or zero topspin removes downward Magnus acceleration. Backspin can support a
shallower launch for the same landing target. Neither changes gravity. A real
baseline rally also contains a bounce before the receiver's contact: contact-to-
contact distance is longer than airborne distance to the first bounce. Tenmulate's
zones specify that first bounce, not the receiving player's feet. Drag makes
average flight speed substantially lower than launch speed. These distinctions
help explain a slow-looking warm-up ball without assuming a measured launch speed.

They do not prove that every 50–70 km/h launch can travel the entire 23.77 m before
its first bounce with low clearance. That stronger numerical claim requires
measured launch height, spin, speed and bounce position. Existing authored targets,
cameras and the meaning of the launch-speed control must not silently change.

## Forward-model check, independent of target selection

A separate two-dimensional RK4 implementation used the force equations, standard
gravity, mass 57.7 g, radius 33.5 mm and drag coefficient 0.55. It imports no app
code. Sensitivity checks also used measured drag 0.507 and Cross's alternative
lift relation; changing these reasonable coefficients did not explain the
multi-metre lofting caused by the planner.

- Published example: 108 km/h, 1 m contact, zero spin, 8.1° launch gives about
  23.77 m carry. The unchanged app forward integrator gives 23.27 m. This is an
  approximate benchmark with different ball/ground assumptions, not exact
  experimental calibration.
- At 70 km/h, 20°, 600 rpm topspin and 1.05 m contact, app carry is 19.575 m;
  independent RK4 gives 19.638 m. Peak heights are 2.843 and 2.858 m. The numerical
  integration difference is centimetres, not the reported metres.
- In the independent fixed-target calculation, 70 km/h to a first bounce 20 m
  away needs approximately 2.07 m net clearance at 600 rpm topspin, 1.86 m at
  zero spin, and 1.39 m at 1,500 rpm backspin. The net in this comparison is at
  the path midpoint; average horizontal speeds are about 53–55 km/h. This is a
  modeled comparison, not a measurement of warm-up players.

Gravity, drag, lift, spin decay and bounce forces are therefore unchanged in this
update. Air coefficients remain an approximation; matching a published example
does not validate every spin, ball condition or stroke.

## Code findings and implementation

Both directions already called the aerodynamic resolver. The high player return
was mainly a *selection* problem: an outer search could reduce return pace to 80%
to fill a requested interval, while the inner objective tolerated excessive height
to preserve pace/spin. This could select a 5 m clearance groundstroke. The previous
Flat profile also imposed at least 250 rpm; a genuinely spin-free feed was absent.

[ADR-0040](../decisions/0040-neutral-groundstrokes-and-contact-fitting.md) defines
the replacement. Natural groundstrokes explore reduced spin at the requested pace
first. If that produces a legal, receivable ball with at most 1.7 m clearance,
pace is retained. Otherwise a joint pace/spin search prefers a lower arc. Flat
allows zero spin and defaults to 120 rpm; saved explicit spin values remain.
Topspin and slice retain their axes, including when spin is reduced. The model
does not quietly turn a topspin shot into a slice.

Fitting also checks real receiving contact windows and, when needed, opponent
movement/preparation. Previously a legal landing could be accepted only to fail
the subsequent intercept. The reproduced serve-and-volley failure needed roughly
another tenth of a second for the opponent; selecting a different physical flight
now supplies that time. This uses the configured bounce phase, not a frozen ball
or a switched contact phase. Groundstroke returns no longer receive an outer pace
reduction just to fill an interval. Actual physical intervals are reported.

Natural may still resolve a higher launch speed when neutral spin and legal
contacts cannot satisfy the geometry. The fallback is bounded and the resolved
speed remains visible. For example, the fixed 22.4 m case used in the rendered
comparison changes from 77 km/h / 600 rpm / 2.24 m clearance to 92.75 km/h /
157.5 rpm / 1.17 m clearance. Its average horizontal flight speed is 71.3 km/h.
This result is **not** described as a literal 70 km/h launch. Explicit high
clearance and Lob stay high; Exact retains speed/spin and may remain unreachable.

The tooltip identifies **Your ball** or **Opponent ball**, with separate **Peak
height**, **Height at net**, and **Over net tape** readings. Peak excludes later
bounces. In the browser example, the player path is 2.25 m above the court at the
net and 1.33 m above its tape. The old single clearance label invited comparison
with a different height reference; the sampled rendered path supplies every value.

## Local verification receipt

Seed `18427`, hard court, six Quick Rally repetitions per case, requested launch
settings of 50/60/70 km/h, near-zone depths 8.5/10 m, and intervals 2.5/5 s:

| Request / near depth / interval | Old maximum player clearance | New maximum |
| --- | ---: | ---: |
| 50 km/h / 8.5 m / 5 s | 5.01 m | 1.27 m |
| 50 km/h / 10 m / 5 s | 4.73 m | 1.33 m |
| 60 km/h / 10 m / 5 s | 3.41 m | 1.24 m |
| 70 km/h / 10 m / 5 s | 2.97 m | 1.18 m |

All 12 cases complete six repetitions; maximum player clearance across the
matrix is 1.35 m. Targets are preserved. All 16 bundled player drills compile
without planning issues. These are bounded reproductions, not a guarantee for
arbitrary Exact settings, unreceivable cameras or air-shot combinations.

- **495 tests across 46 files pass**. Coverage includes identical mirrored physics,
  zero-spin persistence, explicit high/Exact/Lob behavior, live sample-derived
  readouts, slow/deep rallies, all nine player/opponent contact-phase combinations,
  two-set drills, physical handoffs and prepared motion entries. A full-recovery
  test now uses an explicit rest; a long requested interval cannot imply a floating
  ball while the opponent completes a detour.
- **Production build passes**, including TypeScript and the active 25-clip opponent
  asset/cache guard. The existing large-chunk advisory remains. No motion asset or
  renderer effect was replaced.
- **13 production-browser checks pass** in isolated Edge/Playwright on
  `http://127.0.0.1:5173/`, at 1680×1000 and 390×844. Browser plugin unavailable;
  the isolated context blocks service workers and does not touch owner storage.
  Checks cover flat/zero-spin rally playback and reload, both actual bounce zones,
  both path tooltips, edited pace resolving a new flight, opening/player/response
  playback, persistent scene mounting, mobile overflow, and no console/runtime
  errors. Desktop/mobile images and fixed-camera before/after renders were viewed.
  The render harness reports no WebGL errors.

Raw probes, independent calculations, scripts, screenshots and JSON receipts:
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/low-groundstroke-rallies/`.
`baseline.json` and `final.json` retain measurements; `research.mjs` and
`independent-physics.json` retain the independent check; `browser-results.json`
and `render-results.json` retain browser evidence. Research assumptions and the
published forward benchmark are also recorded here and in the regression suite.

Status: local implementation and live local build verified. No public deployment.
Real-court measured trajectory calibration and owner assessment of the resulting
pace remain separate from these numerical and browser checks.
