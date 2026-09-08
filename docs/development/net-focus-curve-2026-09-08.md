# Net-to-camera blur refinement — 2026-09-08

Status: implemented and verified locally. [ADR-0025](../decisions/0025-net-to-camera-focus-envelope.md)
updates the envelope and controls around the existing depth-dependent lens renderer.

## Delivered behavior

- Perspective → Maximum blur spans **0–5 CSS px**, with **0.1 px steps** and a
  **1.5 px default**. Focus remains optional and shared across Practice, Editor
  and drill playback. Valid saved values survive; older values above 5 are clamped.
- Incoming balls activate the effect only after crossing the net. An exponential
  curve rises slowly, then steeply toward the camera: 12% at halfway, 66% at 90%
  of the approach, and 96% at 99%. At/past the camera, the contribution is zero in
  that frame, without a release tail. Outgoing returns and tosses do not trigger it.
- Subpixel lens coverage starts from zero instead of waiting for a 0.35 px radius.
  The separately composited ball remains sharp. Court depth, the focal plane,
  occlusion and the existing renderer lifecycle still govern the lens result.

## Verification

**318 tests in 32 files pass.** Focused contracts cover defaults, decimal persistence,
legacy ceiling clamping, both court sides, net boundaries, scaled volley distance,
the increasing exponential slope, camera crossing, invalid input and outgoing
flights. The production/PWA build and active motion/cache guard pass, retaining the
same 25-clip opponent bundle. The existing bundle-size advisory remains.

Actual Chrome/WebGL checks used the production UI on `127.0.0.1:5173` and an isolated
source-rendering harness on port 4186. Regular Playwright provided the automated
browser checks; the user's in-app tab was refreshed and read back separately.

- Sampled 180 actual gameplay frames; every visible flight supplied its source
  correctly, net/source-side exclusions held, and the session revision stayed fixed.
- Checked 12 positions each for baseline, left/right corners and volley cameras.
  Strength was positive at 0.01% past the net, exceeded 99.9% just before the camera,
  and became zero at the camera. Hidden balls and outgoing returns cleared it too.
- The first captured post-camera output was **pixel-identical to effect-off output**.
  Direct rendering resumed immediately; no lens release frame remained.
- Across 12 ball positions at maximum blur 0 versus 5 px, the sharp ball color layer
  and every fully covered final-output ball pixel were identical. Occlusion,
  disappearance, error cleanup and DPR/viewport resize checks passed without GL errors.
- Production UI checked the new default/range/step, keyboard increments, persistence,
  all three modes and 390 px mobile layouts. Changing focus kept the scene instance
  and session revision stable. No browser errors or horizontal overflow occurred.
- Inspected rendered default/max approach and post-camera images. The default is
  restrained, the 5 px option visibly softens distant detail, and the ball silhouette
  stays crisp. The in-app preview loaded `app-ye-CNfmC.js` with focus enabled at
  **1.5 px**, max 5 and step 0.1; the user's 61 km/h practice setting was preserved.

Artifacts and reproducible scripts are in the local visualization directory:
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/net-focus-curve/`.
Receipts: `court-result.json`, `lens-result.json`, `ui-result.json`. Screenshots
include the six court stages, depth charts and desktop/mobile Perspective controls.
The temporary 4186 harness was stopped after verification; the user's preview remains.

The effect keeps the existing render targets and bounded gather; this change adds
no motion/trajectory calculation or per-frame React state. The checks above establish
local visual behavior, not device thermal qualification or public deployment.
