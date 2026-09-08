# ADR-0026: Clear ball focus on frame exit

- Status: Accepted for local implementation
- Date: 2026-09-08
- Supersedes: ADR-0025's camera-passage cutoff as the visible endpoint.

The owner requested clearing blur as soon as the ball leaves the picture, slightly
before it passes the camera. Each render frame now builds the camera frustum from
its current projection and view matrices. Only balls whose rendered bounding sphere
intersects that frustum can contribute to focus. Bounds include high-contrast ball
scale; partially visible balls still qualify. Fully off-frame balls contribute zero
immediately, with no taper or release history. Another visible incoming ball can
still supply focus during overlapping flights.

This uses Three.js's existing sphere/frustum test and reusable matrix/frustum
objects. No extra rendering passes, raycasts, trajectory work or React state are
introduced. Net gating, the exponential curve, 0–5 px control/default 1.5 px,
sharp ball composition and depth-dependent lens rendering remain unchanged.

## Local verification

Eight focused ball/lens tests, production/PWA build and the active motion/cache
guard pass. Actual Chrome rendering at 1200×800 and 390×844 checks 48 samples across
four frame edges, standard/high-contrast scale, and inside/partial/outside states.
Off-frame output is pixel-identical to effect-off output on the first draw. Camera
turns, FOV changes and overlapping incoming-ball handoffs also pass without GL or
browser errors. The lower-edge screenshots show the still-sharp partial ball before
exit and restored scene detail after exit.

The Browser plugin was unavailable; the existing regular Playwright setup ran an
isolated source harness on port 4186. Artifacts are under the local visualization
directory `2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/frame-exit/`, with reproduction
script `../frame-exit-qa.mjs`. The temporary harness was stopped after verification.
The user's 5173 preview was refreshed through the in-app browser and confirmed
healthy on `app-BDxlh5Jt.js`, preserving focus on, maximum 1.5 px and launch speed 61.
These are local implementation checks; no public deployment occurred.
