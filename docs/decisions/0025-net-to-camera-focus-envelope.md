# ADR-0025: Net-to-camera focus envelope

- Status: Accepted for local implementation
- Date: 2026-09-08
- Supersedes: ADR-0023/0024's approach envelope and maximum-blur range/default.
  ADR-0024's depth-dependent lens renderer, sharp ball layer and lifecycle remain active.

## Context

The owner requested finer control, a 5 px ceiling with a 1.5 px default, and an
exponential increase only after the incoming ball crosses the net. Blur must clear
as soon as the ball passes the camera. The previous distance smoothstep could
activate before the net, taper prematurely at screen edges and retain a release
tail for 0.22 seconds after crossing.

## Decision

1. Share a 0–5 CSS-pixel maximum in 0.1 px increments across all Perspective controls.
   New/missing preferences default to 1.5 px with focus off. Preserve valid saved
   choices; clamp older/imported values above 5 px instead of resetting other settings.
2. The court net is world z=0. For an incoming flight originating on the opposite
   court half, normalize current court depth as `p = ball.z / camera.z`. Only
   `0 < p < 1` and positive camera-forward distance qualify. This scales to baseline,
   corner and volley views, including a moving drill camera. It also cuts off balls
   behind an angled camera's view plane before they cross its court depth.
3. Set strength to `expm1(4*p) / expm1(4)`. It reaches approximately 3%, 12%, 36%
   and 66% at 25%, 50%, 75% and 90% of the net-to-camera approach. There is no viewport
   edge taper, temporal attack or release history. At/past the camera, that ball's
   contribution is exactly zero in the same render frame. No qualifying ball means
   direct rendering; if another incoming ball qualifies, it supplies the effect.
4. Supply each ball's actual flight source to the visual envelope. Outgoing virtual
   returns and serve tosses have not crossed from the opposite half and cannot
   reactivate blur. This avoids historical crossing state during seeking or slot reuse.
5. Remove the shader's 0.35 px coverage dead zone and positive-radius pass threshold.
   Subpixel defocus blends continuously from zero after crossing the net. The
   camera-forward focal plane still uses the existing inverse-depth interpolation;
   ball color is still composited separately after lens blur.

No trajectory, motion, session-clock or React frame-state work is introduced. The
same render targets and fixed 16-sample lens gather are reused. The net/camera
boundaries are exact; tiny early subpixel changes are intentionally subtle.

See the [verification receipt](../development/net-focus-curve-2026-09-08.md).
