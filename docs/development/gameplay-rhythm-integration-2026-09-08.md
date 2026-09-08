# Gameplay rhythm integration — 2026-09-08

Local implementation on `main`; no push or public deployment. Planner identity is `gameplay-rhythm-v1`, content revision `2026.09.08`; ball force
calibration remains `ball-v6-spin-target`. The source objective
was the owner's Quick Practice / Pre-programmed Drills gameplay integration brief.
[ADR-0015](../decisions/0015-mode-aware-gameplay-rhythm.md) and [ADR-0016](../decisions/0016-bounded-rally-arcs-and-drill-pace.md) record the decisions;
[local motion pipeline](local-motion-pipeline.md) is the current runtime contract.

Implementation stages: `f983ce1` adds the planner, coverage model and physical
return solver; `433f60a` integrates all gameplay surfaces and records the bounded
arc and fixed-speed refinements from production review.

## Requirement and evidence map

| Requirement | Implementation authority | Verification |
| --- | --- | --- |
| Practice stays near a fixed home, with no resets between strokes | `compileSession`, `planRecovery`, `sampleOpponentTimeline` | Complete both-hand practice paths at 120 Hz; initial/final home and speed bounds |
| Recover at a measured pace, travel directly when necessary | `opponentMovement`, per-repetition recovery policy | Slow/fast wide drills, serve-and-volley, and short-rest continuity |
| Relative launching rhythm | `rhythm`, compiler, setup/library/editor | 50–150% controls, source-clock bounds, legacy migration and exact independent ball speed |
| Player catchability | `playerCoverage`, scripted camera path | Response delay, acceleration, height, net/serve/bounce checks, camera position and 12% display allowance |
| Physical return to next shot | `rally`, shared 240 Hz integrator | Legal bounce/net, 2.5 cm contact tolerance, speed ratio, bounded apex, exact handoff time |
| One visible ball through a linked rally | `sessionFlights`, `TennisScene`, `sessionCues` | Outgoing cut at receiver contact; return cut at next racket contact; seek determinism |
| Same preview and rehearsal behavior | `SetupScreen`, `DrillEditorScreen`, `SceneViewport` | Compiled preview sessions, normal/compact selection and actual loaded model |
| Preserve the motion asset | `OpponentRig`, active manifests | Both-hand contact checks after IK at 0.85/1/1.2; unchanged 24-clip GLB and single-bundle precache |

## Implementation details

The natural drill interval uses physical flight time and the minimum feasible
motion route. A full recovery detour is selected only if it fits. Quick Practice
always reserves its home route. Motion rates are uniformly scaled in the source
clock, within 0.85–1.2; phase markers and rigid racket attachment are preserved.

A return is not stretched to fill idle time. The inverse solver tries bounded
interception/duration candidates and integrates the chosen launch velocity with
existing drag, spin, wind and bounce physics. Accepted speed is 0.65–1.35 of the
preceding actual launch, with apex limits of 6 m for ordinary shots, 4.5 m for
volley feeds and 10 m for overhead lob feeds. A failed search means no validated
link was found. It is not an exhaustive proof of physical impossibility. A new
feed is shown at failed links, new serves and work-block rests.

Compiled drills now use fixed-speed trajectory resolution. This removes the
legacy target solver's tendency to increase launch speed while correcting landing
position. Impossible aim/speed combinations retain the solver's closest legal
arc and may fail coverage; they do not make the opponent or receiver teleport.
Camera-motion intensity changes explicitly restart/recompile the set so coverage
and playback use the same virtual camera path.

The Overhead shot option uses the existing normal-serve proxy, with its self-toss
suppressed. Dedicated overhead, half-volley and one-handed-backhand motion remain
separate asset work. The Corner switch drill has explicit ±3.6 m sideline origins
and a center shot. Forehand/backhand primitive IDs preserve their stroke identity.

## Verification

- `npm test`: **247 tests / 23 files passed**.
- `npm run check:motion`: passed with the unchanged `f313ece32de3` GLB, 24 clips,
  1.88 m articulated model.
- `npm run build`: TypeScript, Vite, PWA and selected-motion precache passed.
  Existing large-renderer-chunk warning remains.
- Browser skill unavailable. The existing Playwright runtime drove Chrome at
  1440 × 1000 and 767 × 898. Development UI checks passed for rhythm, compact
  serve preview/rehearsal, pause/next, fast Corner switch movement, saved editor
  rhythm, overhead selection and an actual return flight. No application errors;
  one existing GPU shader precision warning. Mobile horizontal overflow: 0 px.
- Production preview at `http://127.0.0.1:5173/` passed the same UI flow at both
  viewports. A separate production readback captured a real return at session
  time 5.0605 s with the loaded articulated model moving toward its next shot,
  then verified camera-intensity recompilation/restart. No application errors.
- A bounded audit compiled all 16 bundled drills at 60/100/150% (48 cases).
  It accepted 59 return links; worst endpoint error was 0.022675 m, and maximum
  accepted apex was 5.732106 m. Crosscourt Rhythm linked every transition at
  100% and 150%; Corner switch linked both transitions at 150%. Slow cases
  retained recovery where it fit. Serve and close correctly chose direct
  forward movement; its default receiver/ball combination failed coverage and
  remained separate feeds. Compilation averaged 63.9 ms per short audited
  sequence (maximum 200 ms); these are local bounded measurements, not a
  performance qualification.

Temporary QA scripts, screenshots and JSON readbacks are outside the repository:
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/`.
The unrelated concurrent `tmp/pdfs` research directory was left untouched.

## Remaining acceptance boundaries

Owner/coach judgment of coverage and rhythm, dedicated proxy replacement clips,
and target-device/browser qualification remain open. Headless browser FPS is not
a device-performance acceptance result. No public deployment is implied.
