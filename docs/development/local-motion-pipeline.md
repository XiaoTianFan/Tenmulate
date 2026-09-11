# Local opponent motion pipeline

Current runtime contract, reconciled 2026-09-11. [ADR-0012](../decisions/0012-local-opponent-motion-pipeline.md) establishes the local production boundary; [ADR-0014](../decisions/0014-articulated-player-and-complete-motion-library.md) records the current model and library. The [integration receipt](motion-main-integration-2026-09-07.md) separates merge, automated checks, live review and remaining release gates.

## Authority and ownership

The current landing and setup-preview contract is
[ADR-0018](../decisions/0018-uniform-landing-zones-and-continuous-preview.md).
`compileSession` samples uniform landing zones for all practice families and drill
events before deriving contact orientation, trajectory, reachability and rally
links. `ContinuousPracticePreview` joins fresh batches through the same recovery
planner on an absolute clock. Its setup stream has no set-end rest or restart;
launched practice still uses the finite compiled session. No motion asset changed.

[ADR-0039](../decisions/0039-direct-court-editing-and-rally-contacts.md) extends
Quick Rally with continuous physical pseudo-returns. `bounceContact.ts` supplies
the configured rise/apex/early-descent phase to both the Quick Rally connector
and player-first drill planner. [ADR-0044](../decisions/0044-contact-anchored-opponent-reception.md)
anchors connected-return recovery, split-step and approach to the player's release
and the selected physical intercept. The shared planner adapts movement and stroke
rates, allowing partial recovery or a continuing approach when required, without
changing the selected phase. Source clocks and rigid contact anchors remain intact.
A setup-only ready pose allows direct body-root placement without editing any
source clip. See the [rendered reception receipt](rally-contact-reception-2026-09-10.md).

[ADR-0036](../decisions/0036-independent-return-shot-and-spin.md) adds independently
configured return styles and an incoming drop-shot family. The planner resolves
the next opponent contact from that physical return. Drop shots use the existing
ground/slice clips; volleys and overheads retain their family-specific routing.
The active bundle, source clocks, grips and contact anchors below are unchanged.

| Surface | Authority |
| --- | --- |
| Gameplay, ball flight, session clock, world travel and foot correction | This repository: `compileSession.ts`, `opponentTimeline.ts`, `opponentMovement.ts`, `OpponentRig.ts`, `TennisScene.ts` |
| Active animation URL, hash, clip clocks, contact anchors, scale and floor offset | `src/content/opponent-motion.json` |
| Model identity and nominal height | `src/content/opponent-asset.json`; [asset record](../assets/quaternius-articulated-mannequin.md) |
| Published provenance and detailed phase metadata | `public/assets/opponents/tennis-local-v1.manifest.json` |
| Sources, recipes, anatomical fitting, Blender bake and motion evidence | Independent sibling repository `F:/Codes/Tenmulate_motion_analysis`; its README and `docs/README.md` |
| Historical corrections | Lab `docs/motion-revision-2.md` through `motion-revision-13.md`, volley/model/compact records and `docs/evidence/` |

Production is **visual reference-led authoring**, constrained joint fitting and Blender baking. Extracted monocular poses are optional diagnostic experiments, not production inputs. Source videos, models, Python environments, filmstrips and editable Blender masters stay in the lab. No runtime inference or cloud mocap service is required.

## Active model and library

The 1.88 m CC0 Quaternius articulated mannequin has a faceless head, smooth limb panels and dark joints on the established 65-bone tennis armature. The old semi-realistic body is a retained skeleton/provenance source, not the displayed player. The runtime loads a single GLB containing the bound model, rigid racket and all animations.

Active bundle: `tennis-local-v1.64f3bc37161d.glb`, **3,198,012 bytes**.
SHA-256: `64f3bc37161dfc2fcf536e80a6e39465792bdc6a822dd26493d04d2ab2bd3eaf`.

| Group | Clips |
| --- | --- |
| Shared stance | `ready`, `split-step` |
| Groundstrokes | `forehand`, `backhand`, `forehand-slice`, `backhand-slice` |
| Volleys | `forehand-volley`, `backhand-volley` |
| Overhead | `backhand-overhead` (generic authored technique) |
| Serves | `serve`, `serve-compact` |
| Gait and adjustment | `run-forward`, `walk-forward`, `move-left`, `move-right`, `move-forward`, `move-backward` |
| Crossover | `cross-front-left`, `cross-front-right`, `cross-back-left`, `cross-back-right` |
| Other movement | `jump`, `slide-left`, `slide-right`, `slide-forward` |

All **25 clips** share calibrated boundaries and the same rig. The overhead addition retains all prior 24 clip layouts, exact timestamps and metadata. Twenty-three have identical decoded values; the forehand differs by at most **2.3841858e-7**, two float32 ULPs at unit magnitude. See the lab overhead preservation receipt; this is not a claim of binary identity.

## Stroke and movement behavior

[ADR-0021](../decisions/0021-prepared-stroke-entry-after-travel.md) adds lab-authored
`unitTurnComplete`/`preparedEntry` boundaries for both drives, slices and volleys.
Under [ADR-0029](../decisions/0029-interval-first-motion.md), incoming travel advances
the source preparation clock while braking and ends exactly at stroke entry.
Spare time is spent ready before approach, with no static prepared-pose dwell.
The stroke starts after the completed unit turn, with no ready-pose reset. Foot IK
fades into the baked stance; contact alignment uses the same height envelope on
both sides of entry. The shared compiler/planner reserves this transition before
assigning contact times (`gameplay-rhythm-v8`). Standalone strokes without incoming
travel, serves and overhead proxies retain full preparation. The GLB is byte-identical
to the preceding bundle; only phase/entry metadata changes. See the
[prepared-entry verification](prepared-stroke-entry-2026-09-08.md).

Forehand preparation and lag follow the rear UCLA take's rhythm/height rather than the low-ball frontal take. A stable roughly 48-degree elbow follows a low-to-high hitting arc; the pelvis stays sideways longer as the shoulders rotate to contact. Backhand retains its deeper coil, two-hand grip, smooth drop and delayed pelvis release. Both volleys have distinct compact punches, controlled balancing arms and held chest turns. The six groundstroke/slice/volley clips widen the stance and lower the pelvis through the shot.

Ready, split and movement share a two-hand belly/chest carry and forward athletic lean. Running uses rear heel recovery with distance-driven cadence. Crossovers rotate and translate the pelvis and use mirrored anatomical leading-foot selection, avoiding the former deep squat from unreachable foot targets.

`strokeForShot` resolves serve rhythm, then stroke side and family before spin. Backhand overhead uses its distinct generic authored one-handed clip at its natural contact height (about 2.26 m). Forehand overhead retains the normal-serve proxy without a self-toss. Half-volley and one-handed-backhand labels still use core-motion proxies. Slices select their own clips.

[ADR-0047](../decisions/0047-automatic-opponent-stroke-and-footwork.md) supersedes
the forced alternating-side/sidestep behavior in ADR-0015/0016. Quick Practice and
player-first drills share `resolveOpponentStroke`: Automatic compares feasible
forehand/backhand body roots at the immutable incoming ball contact, minimizing
travel and unnecessary switching. Explicit sides remain binding. Independent feeds
stay at the selected root; connected rallies derive subsequent roots from the
physical return. Neutral is an area, so already-balanced nearby roots avoid a
centre excursion. Wider/shorter exchanges retain partial recovery or direct travel.
Reactive approaches spend spare time ready, then move at the resolved pace and
finish preparation at arrival. Serve roots remain at their configured starts.

[ADR-0029](../decisions/0029-interval-first-motion.md) makes the requested shot
interval (1–30 s) primary. Stroke rhythm and movement pace (50–300%) are secondary
preferences. A bounded parameter search resolves rates before extending infeasible
gaps; resolved stroke clocks remain uniformly scaled and independent of ball speed.
Long gaps contain ready time. Return links must fit within one physics tick of the
scheduled interval. Travel retains push-off, cruise and braking with zero endpoint
velocity/acceleration, bounded to 7.2 m/s and 12 m/s². At preferred 100%, the movement
limits remain 3.2 m/s and 4.4 m/s² before fitting.
[ADR-0032](../decisions/0032-speed-and-cadence-locomotion.md) solves adjustment,
walking, jogging and running weights from planned speed, acceleration and cadence
demand, including short quick routes. Stable per-leg weights and cycle distance
drive both source poses and foot plants; source-rate budgets are 1.25× walk,
1.35× adjustment and 1.8× run. The preceding shot's movement rate owns recovery;
the incoming shot's rate owns its approach.
[ADR-0033](../decisions/0033-complete-short-running-steps.md) corrects the initially
shuffling short-jog presentation: urgent short routes complete two finite foot
placements with clear running heel lift, an anatomical source-phase offset and
exact start/end anchors. The pattern blends into ordinary cyclic travel outside
the short-route/rate envelope. Torso acceleration lean preserves
pelvis and fixed-length foot IK. Slides/crossovers retain their authored poses;
near-zero-distance legs reserve a smooth turn. These envelopes are product calibrations.

ADR-0047 extends finite placements to small nudges in all directions and blends
heading turns out for unhurried corrections. Moderate lateral recovery can begin
with a front/back crossover; urgent travel recruits running. Source-rate budgets,
physical limits and the authored bundle remain unchanged. See the
[current rendered footwork receipt](opponent-footwork-2026-09-11.md).

Setup, editor preview and rehearsal consume compiled sessions. The quick-practice camera stays at the chosen position. Drill receiver coverage follows the rendered scripted camera, including its intensity setting; changing that intensity restarts and recompiles the set. The coverage model and its explicit 12% screen allowance are documented in [player coverage](../research/player-coverage.md). Quick Practice records reachability without altering the incoming ball. Drills link accepted returns through the physical solver, with distinct outgoing/return handoffs and matching contact/bounce audio. A return must arrive within 2.5 cm of the next racket contact and keep launch speed within 0.65–1.35 of the incoming launch. Ordinary return arcs are capped at 6 m, volley feeds at 4.5 m, and overhead lob feeds at 10 m. Natural target mode follows the low-angle range branch and may adjust speed by ±15% and spin by ±20%; resolved values and unreachable targets are reported. Exact mode retains requested speed/spin. Failed links, rest boundaries and new serves start a new feed.

The return solver searches a bounded set of candidate interception times and flight durations. A failed solve means no valid link was found, not a proof that every possible human return is impossible. The model is a virtual-camera coverage heuristic, not body tracking.

The same runtime supports 19 explicit movement review drills, including back crossovers, jump and sideways/forward/diagonal slides. Automatic hard-court recovery uses footsteps; merely bundling a slide does not make every recovery a slide. `sampleMovementDrill` provides explicit variants for future gameplay selection without a second animator.

## Two serve rhythms in actual practice

Select **Return**, then **Opponent → Serve rhythm**. Choose Normal or Compact. The drill editor also supports a per-event override. Resolution is explicit event override → practice setting → shot preset; undefined defaults to normal.

| Clip | Toss release | Contact | Full cycle |
| --- | ---: | ---: | ---: |
| Normal `serve` | 0.883 s | 1.783 s | 3.250 s |
| Compact `serve-compact` | 0.633 s | 1.300 s | 2.400 s |

Both run at their authored rate of 1 at 100% rhythm, with the same bounded uniform scaling at other percentages. Compact is a distinct pinpoint gather, low toss, early pickup and quick launch, not normal sped up by 1.25×. The source is the owner's Kyrgios clip: first-pass cadence plus same-camera slow replay for geometry. At equal 2.75 m contact height, measured toss apices are 3.256 m normal and 2.874 m compact.

For serves, the toss starts at the corrected release hand, follows a ballistic path and hands over to the outgoing ball at contact. Rhythm does not change outgoing ball physics. Both handedness settings use the same validated mirroring, contact alignment and airborne knee-plane preservation.

## Build, publish and review

From the lab:

1. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1`; install frontend dependencies with `npm ci`.
2. Verify local sources in `config/sources.json` and phase/view authority in `config/references.json`.
3. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build.ps1 -Publish` builds previews, solves, bakes, checks export/choreography/anatomy, publishes and validates the actual consumer.
4. Run the relevant preservation check when refining an existing library. The latest overhead addition uses `node scripts/check_overhead_preservation.mjs` and `work/practice-refinement-baseline`; historical compact preservation uses its own retained baseline.
5. In this frontend run `npm run check:motion`, `npm test`, `npm run build`.

Publication rejects failed/stale/partial reports. The consumer check independently verifies model/library hashes, metadata, clips and calibration. The production build also checks that its service worker precaches **only the selected opponent GLB**. Older bundles remain on disk for evidence and rollback; changing an asset pointer alone is not a safe rollback because metadata/calibration must agree.

Review services run in separate terminals:

| Working directory | Command | URL |
| --- | --- | --- |
| Frontend | `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` | `http://127.0.0.1:5173/` — actual practice |
| Lab | `node scripts/review_server.mjs` | `http://127.0.0.1:4184/` — phase/source comparison |
| Lab | `node scripts/gameplay_server.mjs` | `http://127.0.0.1:4185/review/gameplay.html` — actual renderer with review controls |

The normal/compact comparison is `?sequence=serves` on the gameplay review URL. The frontend's unoverridden Vite default is port 4173; 5173 is the explicit review command above. These local services are not a public deployment.

## Evidence and limits

Blender bakes at 120 Hz. The lab checks exported and interpolated poses at 240 Hz: 63 articulated joints, fixed lengths, grips, signed racket face, clearance proxies, contact, stance, continuity and clip closure. Both-hand gameplay repeats checks after real blending/IK, including 38 movement sweeps and crossover support checks. These are animation plausibility gates, not clinical certification or complete mesh-collision testing.

Visual review must include normal-speed playback, frame stepping and representative front/rear/side/gameplay views. Independent reference takes align by named phase; missing views and secondary performers stay labeled. The compact replay is explicitly the same camera. Backhand overhead is a generic authored addition with no captured-performer claim; forehand overhead retains its serve proxy without a self-toss. Tests do not replace the owner's technique review.

Public hosting, public provenance review, target-device performance and final owner technique acceptance remain separate release gates. See the integration receipt for the current verification run; historical revision test counts are not current suite totals.
