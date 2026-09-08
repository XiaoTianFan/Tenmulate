# Renderer cost investigation — 2026-09-08

## Reproducible instrumentation

Open the app with `?profileRenderer=1`. Each mounted court publishes JSON once per
second in `canvas.dataset.rendererProfile`. For example, in browser DevTools:

```js
JSON.parse(document.querySelector('canvas').dataset.rendererProfile)
```

`TennisScene.getRendererProfile()` returns the same report; its constructor also
accepts `{ profile: true }`. `resetRendererProfile()` starts a steady-state window
after assets/shaders have warmed up. Profiling is off by default. It records:

- Actual WebGL adapter, CSS and drawing-buffer dimensions, pixel ratio, asset
  variant, audience count, shadow resolution, draw calls, triangles and resources.
- CPU environment, session scheduling, opponent animation, ball update,
  camera/presentation, render submission and full-frame costs.
- Asynchronous GPU render time, separately from CPU submission and RAF cadence.
  GPU time includes shadows and the main scene; CPU stage timings do not attribute
  GPU fragment cost. Controlled feature ablations provide that attribution.
- Median/p95 over the latest 600 samples, total sample count and the maximum since
  reset, so occasional stalls are retained. Hidden frames are excluded; resize,
  environment changes and scene activation reset the comparison window.

The timer queues at most eight WebGL queries, checks availability before fetching
results, discards disjoint measurements, and releases queries on reset/disposal.
Unsupported timers still produce CPU data. No `gl.finish`, pixel readback or GPU
identity query runs in normal gameplay. Six tests cover these lifecycle contracts.

## Initial baseline

The actual user tabs selected **different adapters**: Edge used Intel UHD (device
0xA788), while Codex's embedded Chromium used NVIDIA RTX 4080 Laptop (0x27E0).
Both WebGL contexts requested `powerPreference: high-performance`. This request
does not guarantee selection of the discrete GPU. Edge had already switched to
the Performance venue; Codex retained Quality. These are not equivalent FPS tests.

Controlled isolated Edge tests use the same Hard Open Arena, Half seated (6,652
spectators), Quality geometry, 4096 shadow map, DPR 1.5, highlight and trajectory,
70 km/h alternating groundstrokes, 1,103 rpm, seed 18427, 5 s interval. No features
or resolution are reduced between baseline and candidate. CPU work is about
1.4–3.4 ms; Intel GPU cost grows strongly with drawing-buffer area.

The two measured candidate changes are excluding exactly zero-intensity fixture
lights from the shader and drawing the physical sky after opaque geometry.

| CSS size | Buffer pixels | Intel GPU baseline/candidate | RTX GPU baseline/candidate |
| --- | ---: | ---: | ---: |
| 600 × 400 | 540,000 | 20.21 / 17.90 ms | 0.79 / 0.77 ms |
| 1280 × 800 | 2,304,000 | 40.54 / 29.76 ms | 1.07 / 0.98 ms |
| 1920 × 1080 | 4,665,600 | 62.15 / 40.11 ms | 1.52 / 1.29 ms |
| 2560 × 1600 | 9,216,000 | 89.22 / 53.99 ms | 3.11 / 2.23 ms |

These are median GPU queries across 120 measured frames after 30 warmup frames per
case, in headless Edge 152. RTX selection used a temporary isolated-process
`--force_high_performance_gpu` flag and was verified from WebGL. No OS preference
was changed. GPU timings are not foreground FPS acceptance: compositor cadence,
browser scheduling, presentation, display refresh and other applications matter.
The largest RTX case had 8.3 ms median RAF cadence despite 2.23 ms GPU execution.

The final repository benchmark independently reproduced the RTX result over 240
measured frames: **3.134 → 2.183 ms GPU** at 3840 × 2400 drawing-buffer resolution
(30.3% lower), with identical 227 calls / 1,823,775 triangles in the paired final
frame and about 1.6 ms median CPU work. At the three smaller sizes the pairs were
0.790/0.772, 1.075/0.979 and 1.482/1.294 ms. All reported GL errors are zero.
`renderer-final-rtx.json` retains the complete report.

At the largest Intel size, single-feature diagnostics measured zero-light removal
66.29 ms, sky-last 86.44 ms, no sky 78.30 ms, no audience 77.16 ms and no shadow
69.86 ms. The last three are attribution probes only; removing visual features is
not the implementation. Combined improvements are non-additive and measurements
vary with GPU clock/load. The arena has no transmissive materials; transmission
resolution changes cannot solve this default case.

Primary references: [Khronos asynchronous GPU timer contract](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/),
[Three.js renderer API](https://threejs.org/docs/pages/WebGLRenderer.html), and
[Chromium discrete-GPU launch preference implementation](https://chromium.googlesource.com/chromium/src/+/f35df3e3e2276c4ec658d66961789ceb4fc4e278).

Local baseline artifacts are in
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/`:
`renderer-cost-probe.mjs`, `renderer-cost-baseline.json`, and
`renderer-cost-rtx-baseline.json`.

## Implemented improvements

[ADR-0031](../decisions/0031-measured-renderer-cost-and-preview-preparation.md)
records the implementation. The sky order and zero-light changes keep all assets,
shaders, effects and sampling levels intact. The optional trail now updates one
existing position attribute and its bounds instead of disposing/recreating a GPU
geometry every frame. Contact-anchor diagnostics run only near contact.

An extended run spanning 120 simulated seconds (3,600 rendered samples) found the
original preview compiled six fresh shots synchronously at 33, 63 and 93 seconds.
These render-thread stalls were 115.5, 123.9 and 118.8 ms. A module worker now
prepares that unused future batch, including interval fitting, before the boundary.
It uses exactly the same compiler and seeds and keeps one result ready. Replacing
the session terminates old work, seeking invalidates stale results, and failure or
an unusually large forward seek retains deterministic synchronous recovery. That
mode and cache misses appear in `previewPreparation`; normal playback never waits
for a worker response or moves the session clock to hide a delay.

| Extended rally measurement | Before | After |
| --- | ---: | ---: |
| Session-stage maximum | 124.1 ms | 0.7 ms |
| CPU frame maximum | 126.2 ms | 4.8 ms |
| CPU frame median / p95 | 1.6 / 2.6 ms | 1.6 / 2.6 ms |
| Prepared boundary transitions / misses | — | 3 / 0 |

The test advances the real scene clock at 1/30 s per rendered sample; it is a
deterministic boundary test, not a two-minute wall-clock soak. Its three worker
jobs all completed before their deadlines, despite playback advancing faster than
real time. `renderer-timeline-before.json` and `renderer-timeline-after.json` retain
complete CPU/GPU/RAF statistics. Occasional compositor/GPU scheduling spikes remain
possible; moving compilation does not establish an absolute frame-time guarantee.

## Visual and automated verification

- Nine frozen-state, full-frame comparisons at 1280 × 800: all six venues, plus
  Hard Open Arena dusk, night and rain. No color channel differs by more than 1/255;
  at most six pixels differ at all. Indoor/dusk/night captures are byte-identical.
  Nonzero fixtures remain visible and relighting restores previously hidden ones.
- The trail keeps its geometry/attribute identity while positions advance in all
  nine scenes. Actual day, night and indoor captures were visually inspected.
- **344 tests / 36 files**, TypeScript, production build and active motion/cache
  guard pass. The worker chunk is 49.29 kB and appears in the generated precache.
  The existing shared renderer chunk-size advisory remains; it does not fail build.
- Motion assets, physics parameters, shader quality, resolution policy and finite
  drill playback are unchanged. Local implementation is not public deployment.

Artifacts: `renderer-visual-checks.json` and `renderer-visual-*.png` in the directory
above. Both actual browser tabs loaded production `app-mw90ryRe.js`. Their live
reports confirmed `previewPreparation.mode = worker`, one completed boundary, no
cache misses and another batch ready. Edge remained on Intel (Performance,
1134 × 832 buffer); Codex remained on RTX (Quality, 915 × 771). Their respective
GPU medians were 7.90 and 0.49 ms, which must not be treated as equivalent settings.
The startup-inclusive Codex report also captured first-render shader cost; the
controlled warmed measurements above intentionally separate that from steady play.

The Codex canvas retained the same instance through Practice → Editor → Test drill.
Playback reached the fourth shot and its scheduled rest. Both browsers were then
returned to normal Practice with profiling disabled, preserving their preferences.
All temporary benchmark browsers/servers were closed. Windows' Edge GPU preference
was not changed, and no unrelated browser tabs were closed.

## Repeat the controlled benchmark

`scripts/profile-renderer.mjs` starts a temporary source server on port 4187, uses
an isolated Edge profile, and closes both afterward. It requires Edge and an
existing Playwright tooling installation; it adds no app dependency. Set
`PLAYWRIGHT_MODULE` to that installation's `index.mjs` file URL if it is not
resolvable from this checkout, then run:

```powershell
node scripts/profile-renderer.mjs --rtx --out renderer-rtx.json
node scripts/profile-renderer.mjs --out renderer-default-adapter.json
node scripts/profile-renderer.mjs --rtx --timeline --out renderer-timeline.json
```

The size matrix uses 60 warmup + 240 measured frames for each old-order/current
pair. The old-order case restores zero-intensity light inclusion and early sky
drawing only. The timeline option runs 3,600 frames on the current implementation.
Always read the reported adapter; the process flag is a request, not proof of GPU
selection. Do not run competing GPU benchmarks concurrently. For foreground FPS,
measure the visible app separately with fixed viewport, DPR and Quality mode.
