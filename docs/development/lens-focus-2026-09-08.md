# Lens focus and sharp ball verification — 2026-09-08

## Result and scope

Owner feedback supersedes the first ball-focus renderer. The ball now has its own
full-resolution MSAA color layer and is excluded from the lens input entirely.
That layer uses actual scene lighting and world depth, so it stays sharp while
moving and still respects the net/opponent. Reduced emission and a restrained
fixed-width rim make the outline visibly clear.

The lens focus plane follows the prominent ball's camera-forward distance.
Surfaces on that plane remain clear; foreground and background blur by different
amounts according to inverse depth. The existing approach-strength envelope and
Perspective controls remain shared across Practice, editing and playback.

[ADR-0024](../decisions/0024-depth-of-field-and-sharp-ball-layer.md) records the
method and comparison with Three.js BokehPass. The custom pass reuses world depth,
gathers 16 disk samples at half CSS resolution and protects foreground boundaries.
Sharp-ball work is limited to its screen bounds. Initial allocation, resize and an
empty ball layer use a full clear; this avoids stale MSAA tiles after disappearance.

## Automated and browser evidence

- `npm test`: **316 tests in 32 files pass**. New lens tests establish signed
  near/far defocus, a sharp focal plane, bounded radius and smooth focus transitions.
- `npm run build`: TypeScript, production build and active opponent asset/cache
  guard pass. The pre-existing large renderer chunk advisory remains.
- Regular Playwright/Chrome was used because the Browser testing plugin is not
  installed. Production UI: `http://127.0.0.1:5173/`. An isolated source harness on
  temporary port 4186 used the actual renderer/venue/opponent. QA files are outside
  the repo; the temporary server is stopped after verification.

| Check | Result |
| --- | --- |
| Four identical charts at 1.5, 3, 6 and 24 m; focus at 3 m | 3 m patch is pixel-identical to the zero-blur reference; near/far patches differ by depth |
| Focus shifted to 24 m | 24 m patch becomes pixel-identical to its sharp reference |
| Ball moved to 12 combinations of lateral position/depth | Full sharp-layer pixel difference is zero between 0 and 6 px blur; all fully covered ball pixels in the final output also differ by zero |
| Opaque object in front of ball | Sharp-layer coverage is zero; no ball drawn through it |
| Ball disappears | Zero stale coverage pixels |
| Intentional interruption during ball render | Materials, layers, camera, background, target and renderer state restored |
| 800×700 at 1.5 pixel ratio | World and ball targets both 1200×1050; blur target 400×350; no GL error |
| Actual court, approaching shot | 91 clock samples; peak focus strength 0.859; session revision unchanged |
| Three disable/re-enable cycles | Texture counts 17/12/17/12/17/12, without growth |
| Production Practice → Editor → Test drill → reload | Shared canvas preserved, focus changes do not reset sessions, preferences survive |
| Desktop 1600×1000, phone 390×844, keyboard | Controls usable, no horizontal overflow, Space/arrow controls pass |
| Browser/renderer errors | None |

The fixed chart's mean absolute pixel difference from its sharp reference is
70.59 at 1.5 m, **0 at the 3 m focal plane**, 40.19 at 6 m and 61.97 at 24 m.
This proves depth variation rather than a uniform image-wide blur. Actual player
camera screenshots were also inspected for ball outline, court, net and seating.

## Bounded performance measurement

The comparison uses `EXT_disjoint_timer_query_webgl2` for completed GPU work,
rejecting disjoint/unavailable queries. It compares the preceding committed pass
with this pass in the same frozen scene, after shader warm-up, at 1200×800 and
pixel ratio 1. Each row contains 15 samples. Test adapter: Chrome/ANGLE,
Intel UHD Graphics, Direct3D11, with a high-performance WebGL request.

| Pass | First median / p95 | Reverse-order median / p95 |
| --- | --- | --- |
| Direct rendering | 10.93 / 13.68 ms | 11.24 / 15.17 ms |
| Previous uniform-focus effect | 12.81 / 15.46 ms | 13.25 / 15.89 ms |
| New depth-dependent effect | 14.22 / 19.10 ms | 14.37 / 16.25 ms |

The new pass adds about **1.3 ms median** compared with the previous effect in this
bounded comparison. Both use 202 draw calls / 412640 triangles for one visible
ball, versus 198 / 411917 direct. No second stadium or shadow-map draw is introduced.
Five extra GPU textures are released on disable. Zero blur skips the two lens
passes (200 calls, only three additional allocated textures on a fresh pass).

These GPU-query samples are not a sustained FPS or thermal test. Device-specific
performance and owner visual acceptance remain separate from local verification.

## Reproducible artifacts

`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/lens-focus/`

- `lens-qa.mjs`, `lens-result.json`: sharp-layer/final-output equality, occlusion,
  disappearance, state restoration and resize.
- `court-qa.mjs`, `court-result.json`, `previous-pass.ts`: actual renderer comparison,
  GPU query runs, playback envelope and texture cleanup.
- `pixel-qa.mjs`, `pixel-result.json`: focal-plane/depth-chart pixel analysis and adapter.
- `ui-qa.mjs`, `ui-result.json`: production UI flow and saved settings.
- `chart-sharp.png`, `chart-lens.png`, `chart-focus-far.png`: independent depth planes.
- `court-off.png`, `court-sharp.png`, `court-lens.png`, `court-lens-max.png`,
  `court-mid.png`, `court-far.png`: actual court with the ball at different distances.

The app preview is refreshed locally. No remote push or public deployment is part
of this change. Source/background limitations of screen-space depth of field are
recorded in ADR-0024; the implementation does not simulate a complete optical lens.
