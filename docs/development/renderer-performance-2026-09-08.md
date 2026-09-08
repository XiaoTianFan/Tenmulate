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
`renderer-cost-rtx-baseline.json`. Implementation and visual verification follow.
