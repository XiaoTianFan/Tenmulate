# Tennis camera: evidence, decisions and verification

Date: 2026-09-10. Scope: player-first drill gameplay and sequence preview.

## What was wrong

`compilePlayerDrill` previously started a direct camera transition at the player's
hit, using the whole outgoing-plus-incoming flight to reach the next event. This
revealed the future return's direction before the opponent had contacted it.
Opponent tracking was a travel overlay; it faded back to the future authored view
without distinguishing recovery, reaction or receipt of the ball. Per-event FOV
could interpolate as part of the same transition.

## Research and its limits

- [Split-Step Timing of Professional and Junior Tennis Players](https://pmc.ncbi.nlm.nih.gov/articles/PMC5304278/)
  analyzes 8,545 strokes. Timing differs by shot category and player; the paper
  reports an ATP baseline response average of 0.310 seconds. Split-step phases,
  landing and response onset are different measurements. This supports a
  contact-related readiness stage, not a universal timer for every player.
- [Gaze Behaviors During Serve Returns in Tennis](https://pubmed.ncbi.nlm.nih.gov/29785858/)
  uses mobile eye tracking while players return 40 serves at four locations.
  Higher skill and successful returns were associated with longer pre-bounce ball
  fixation and quiet-eye durations. This supports an incoming-ball attention
  phase. It does not prescribe a literal head pan or lens behavior. The primary
  abstract was reviewed; no claim here depends on inaccessible full-text detail.
- [From simple lab tasks to the virtual court: Bayesian integration in tennis](https://doi.org/10.1152/jn.00434.2024)
  reports two extended-reality serve-return experiments with 32 participants
  each. Gaze combines prior expectations with emerging flight information;
  sensory evidence progressively displaces the prior within a trial. This
  supports allowing tactical intention while avoiding perfect foreknowledge.
  The XR context is relevant to gameplay but is not proof of real-court head
  motion. The primary publisher's indexed article/abstract was available; direct
  full-page access was restricted during the research.
- [USTA Net Generation, grades 5–6](https://www.usta.com/content/dam/usta/content-fragments/tennis-service-center/assets/pdfs/Net-Generation-Schools-Manual-Grade-5-and-6.pdf)
  includes approach-to-net and split-step progressions. This is coaching support
  for advancing behind an approach, not an adult locomotion calibration.

Attention can anticipate from context, so a blanket rule that players never move
before opponent contact would also be unrealistic. Conversely, a deterministic
drill knows much more than a human player. We use only the known outgoing shot
for ordinary recovery and allow explicitly inferred forward approaches. Exact
lateral return positioning starts after contact.

## Implemented behavior

The authored contact camera is retained. Between contacts, the camera watches the
animated opponent, performs recovery or a deliberate approach, reacts to contact,
tracks the incoming ball within the fixed view, and settles for its own stroke.
This balances tennis attention with a stable view the user can edit and rehearse.
When a ball is too near to fit alongside the opponent in a narrow lens, retain
court context rather than zooming or whipping the camera behind the player.

`tennisCamera.ts` owns the phase planner and pure sampler. `cameraMotion.ts` shares
the quintic curve with legacy playback. `compilePlayerDrill.ts` checks the reactive
travel window during physical return/contact fitting; its accepted plan supplies
both preview and gameplay. `TennisScene` samples the actual animated opponent
root and the integrated incoming flight at the session clock and viewport aspect.

Current presentation calibration:

| Behavior | Calibration |
| --- | --- |
| Stroke release hold | 0.12 s |
| Reaction after opponent contact | 0.15 s normally; 0.11 s serve; 0.10 s compact volley/half-volley |
| Split cue | Starts 0.09 s before contact; at most 0.018 m eye compression |
| Contact settling | 0.12 s normally; 0.06 s compact volley/half-volley |
| Reactive position limits | 7 m/s peak, 18 m/s² peak; lower acceleration when overlapping a forward approach |
| Recovery | Comfortable pace limited by outgoing flight time; angle coverage capped at ±1.25 m |
| Attention shift | Smooth 0.28 s ball-weight ramp, trailing samples and soft angular limits |
| Lens | Fixed horizontal FOV; vertical framing derived from viewport aspect |

These constants are product choices, not values directly extracted from the
studies. In particular, reaction presentation is not identical to the response
metric in the split-step study. No eye-tracker model, zoom, roll, blur, random
head bob or stateful spring is added.

The first implementation forced a complete stop during every split. That failed
several approach and volley presets. Giving a chosen approach a continuous depth
curve, using compact volley preparation, and fitting a physically receivable
return repaired those links. Ordinary lateral reception still starts after
contact. Authored zones, opponent hand, contact phases and force integration
remain intact.

## Verification

The implementation stage passes **507 tests across 47 files**, TypeScript and
the production build, including the active 25-clip motion/cache guard. Regression
coverage includes no future target/framing leakage, tactical approaches, split
continuity, both-hand reflection, fixed FOV, stable contact views, seeking,
reduced motion and physical contacts. All 16 bundled drills compile with two
seeds, including two complete sets with the application seed.

A 240 Hz full-clock probe across all bundled drills found peak translation below
5.9 m/s and peak horizontal acceleration below 18 m/s². The measured default
views stayed below 76°/s yaw and 50°/s pitch in that probe. These are fixture
measurements, not universal angular guarantees for arbitrary backward-facing
authored views. Four representative drills enforce continuity/rate bounds in
the regression suite.

Raw scripts and receipts are outside the repository at
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/tennis-camera/`.
`baseline.json` diagnoses old contact windows against the new planner;
`motion-metrics.json` records sampled motion.

### Rendered verification receipt

Implementation commit: `3a41b57`. Production preview: `http://127.0.0.1:5173/`.
The Browser plugin was not available; regular Playwright used isolated headless
Edge with service workers blocked and no access to the owner's browser storage.

The production flow tested was Practice → Drills → Make editable copy → change
zoom → select another shot → wheel zoom → Preview sequence → Test drill → Exit.
All **nine browser checks pass**:

- A slider edit applies to subsequent shots; wheel zoom still works and applies
  across the drill. Playback retains the precise FOV, including fractional wheel
  changes (63.6° rendered while the integer slider displays 64°).
- Sequence preview renders recovery, split, receive and settle. Gameplay renders
  the same contact-driven stages through the subsequent player shot with actual
  lateral camera movement.
- The Three.js scene instance survives editing, preview and gameplay.
- The 390×844 editor has no horizontal page overflow. Desktop verification uses
  1680×1000. Both screenshots were viewed.
- No browser console or runtime errors occur. The exit interaction first hovers
  the header to reveal the intentionally hidden gameplay controls.

A separate 1200×800 render harness uses the actual `TennisScene`, model and venue
at ten exact session times across Crosscourt Rhythm and Approach and close.
It advances the real renderer with the authoritative clock, including opponent
blending, and compares the rendered camera with the compiled sampler. Every pose
matches; there are no WebGL errors. The opponent's upper body is within 5% of
the center in recovery/approach frames and within the viewport during incoming
ball tracking. Stroke/split/receive/settle frames were saved, and representative
baseline and approach images were inspected.

`browser-results.json` and `render-results.json` retain checks, phase traces,
camera poses and projected opponent/ball positions. `verify.mjs` and `render.mjs`
are the reproducible browser scripts. The temporary development server on 4173
was stopped after review; the existing production preview on 5173 remains.

Status: local implementation and local rendered build verified. No public
deployment. Long-session comfort and individual tactical preferences still need
owner assessment; this is not a measured real-player head-motion calibration.
