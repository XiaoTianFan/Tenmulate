# Technology options research

- **Status:** Research baseline
- **Research date:** 2026-08-29
- **Scope:** Browser rendering, ball physics, animation/assets, Blender/AI tooling, and future body tracking

## 1. Executive recommendation

Proceed with a focused technical spike around a React/TypeScript/Vite shell and a direct Three.js engine adapter. Start with Three.js `WebGPURenderer`, whose default behavior is WebGPU with a WebGL 2 backend, but keep a `WebGLRenderer` comparison because Three.js still describes the newer renderer as experimental and documents material/post-processing differences.

Do not use a general physics engine as the primary ball model. Implement a deterministic 3D tennis trajectory solver based on gravity, aerodynamic drag, spin-dependent lift, and an explicit surface-impact model. Use Rapier only if later body/world collisions justify it.

Use a hybrid asset strategy: exact court/net/ball/training geometry generated directly in Three.js, complex skinned opponents delivered as optimized GLB, and Blender as the canonical cleanup/export environment. For opponent motion, prioritize tennis-specific capture plus manual cleanup. Generative 3D and AI mocap tools can accelerate production, but they do not remove the need to validate topology, licensing, footwork, racket path, and contact timing. The current provider/integration comparison is in [AI 3D asset and animation tools: August 2026](ai-3d-asset-tools-2026.md).

Cloud-generated whole worlds are a viable environment-authoring experiment, not a replacement for the exact gameplay layer. Compare Aholo SpatialGen/Reality and World Labs Marble as registered mesh/splat shells around the code-owned court. Prefer an optimized PBR mesh when live sun/day/night controls matter; accept a splat only after renderer, depth/proxy, relighting, transfer, and 4K evidence. See [Cloud world generation and scene reconstruction](world-generation-and-scene-reconstruction-2026.md) and ADR-0004.

## 2. Decision criteria

| Criterion | Why it matters here |
| --- | --- |
| Perceptual timing | A late contact or implausible bounce breaks shadow-swing value even if graphics are attractive. |
| Determinism | Drills, tests, exact replay, and coached comparisons need repeatable outcomes. |
| Large-screen performance | The likely target is 1080p–4K desktop output, not a small embedded canvas. |
| Browser reach | Users should not need a native install; WebGL 2 fallback remains important. |
| Asset/animation workflow | The opponent needs multiple tightly synchronized tennis clips, not a static model. |
| Debuggability | Authors need to see contact, net clearance, bounce, spin, and arrival metrics. |
| Future tracking isolation | V2 body tracking must not force camera/ML complexity into V1. |

## 3. Rendering engine comparison

| Option | Current strengths | Risks/limits | Fit |
| --- | --- | --- | --- |
| **Three.js `WebGPURenderer`** | WebGPU-first with automatic WebGL 2 backend; node materials, TSL, and a modern post-processing path; small, code-first ecosystem. | Three.js calls it experimental; `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile`, and legacy `EffectComposer` paths require migration to node/TSL equivalents. | **Recommended spike/default if benchmarks pass.** New code can stay within supported material APIs. |
| **Three.js `WebGLRenderer`** | Mature, maintained, very broad examples/ecosystem, lower migration uncertainty. | WebGL 2 only; major new renderer work is focused on WebGPU; a later migration can be costly if custom GLSL/postprocessing proliferates. | **Required comparison/fallback plan.** Sensible V1 choice if WebGPU path causes instability. |
| **Babylon.js** | Full engine with WebGPU and WebGL maintained side-by-side, animation/retargeting, physics integrations, GUI/editor features, and extensive game systems. | Larger opinionated engine surface than this front-end simulation needs; switching cost is meaningful; direct WebGPU initialization still has API differences. | Strong alternative if the project grows into a game/editor and Three's spike fails. |
| **PlayCanvas Engine 2** | Web-first engine, TypeScript, WebGPU beta with automatic WebGL 2 fallback, optional visual editor/React/Web Components, strong asset tooling. | WebGPU is documented as beta; editor workflow adds another source of truth unless deliberately adopted. | Strong alternative for a visual-authoring-heavy team. Not the first recommendation for a code-owned deterministic solver. |

### Browser reality

- MDN still marks WebGPU as limited availability and requires a secure context.
- Chrome documents initial availability on ChromeOS/Windows/macOS and later Android support; current rollout has expanded, but platform/GPU/driver gaps remain.
- Three.js's WebGPU renderer can use a WebGL 2 backend, which is valuable only if the app stays within the renderer's shared supported feature set.

The product should report the actual backend and adapter diagnostics, test forced WebGL, and never equate “WebGPU supported” with “fast enough at 4K.”

## 4. Direct Three.js versus React Three Fiber

React Three Fiber is an official-community React renderer for Three.js. Its documentation says it expresses Three objects declaratively without a per-frame React rendering requirement and tracks Three.js features closely. It is excellent for componentized scenes and interactive product surfaces.

For this project, the provisional choice is direct Three.js behind a React-owned canvas because:

- a fixed simulation clock and timeline are central architectural concepts;
- the scene changes continuously while configuration UI changes infrequently;
- explicit renderer/backend initialization and evidence capture are first-class requirements;
- the team should debug Three.js and trajectory behavior without an additional lifecycle abstraction during the spike.

This is not a claim that React Three Fiber is too slow. Reconsider it after the vertical slice if declarative scene composition materially improves maintainability without obscuring clock/renderer ownership.

## 5. Ball physics options

| Option | Strengths | Risks | Recommendation |
| --- | --- | --- | --- |
| **Custom tennis solver** | Directly represents drag, Magnus lift, spin, surface response, target-zone authoring, and exact event times; easy to snapshot numerically. | Requires careful numerical validation and parameter calibration. | **Use for the ball.** |
| **Rapier** | Fast Rust/WASM 3D engine, CCD, SI-unit guidance, snapshots, and documented cross-platform determinism for JS/WASM. | Rigid-body restitution/friction alone do not model tennis aerodynamics or desired landing constraints; custom forces and bounce calibration are still required. | Reserve for later collision-heavy world/player features or as a comparison harness. |
| **cannon-es** | Simple JavaScript rigid-body API and familiar Three ecosystem. | Less compelling determinism/CCD story for this high-speed, test-heavy use case; still needs custom aerodynamics. | Do not select for the core. |
| **Authored spline only** | Cheap, simple, hits exact points. | Hides physical parameters, produces implausible variations/bounces, and makes speed/spin labels decorative. | Useful only as a temporary visual prototype or camera path, not the final ball path. |

### Research basis

A 2026 open-access Sports Engineering study modeled 8,654 tracked Australian Open serves using 3D equations of motion with gravity, drag, and lift. It reported median mean absolute errors of 4.8 mm pre-bounce and 2.4 mm post-bounce against the supplied tracking curves. The paper treats drag coefficient as constant for a trajectory arc and lift as related to spin parameter within the usual range. That is a much closer basis for the product than an uncalibrated rigid-body bounce.

The ITF's 2026 technical booklet provides ball mass, size, rebound, and court-pace test definitions. These should bound and calibrate our model, while observed trajectory data or expert review will still be needed for surface-specific realism.

## 6. Asset and animation pipeline options

### 6.1 Runtime format

Three.js and Blender documentation both recommend glTF/GLB for runtime delivery. It supports PBR materials, meshes, skeletons, skins, morph targets, and animations, and is designed to reduce runtime processing. Use:

- GLB for shipped, self-contained runtime assets;
- `.blend` plus source textures/footage as editable provenance;
- geometry compression only after measuring decode time (Draco or meshopt path);
- KTX2/Basis texture compression after visual review on the browser matrix.

### 6.2 Opponent model source

| Source | Best use | Main concern |
| --- | --- | --- |
| Commissioned/licensed game-ready humanoid | Final V1 base with clean topology and clear commercial rights. | Cost and lead time. |
| Generative model (Tripo/Meshy/Lux3D/Hunyuan/Rodin-class) | Rapid silhouette/style exploration, candidate production meshes, props, and venue drafts. Current tools span PBR, topology/parts, rigging, animation, Blender, API, and agent integrations. | Capability is uneven: Lux3D is currently a new static-asset/material candidate, while Tripo/Meshy advertise broader character chains. Topology, likeness/IP provenance, anatomy, deformation, texture cleanup, and terms must be reviewed per asset. |
| Mixamo character/rig | Fast humanoid prototypes; Adobe says characters/animations may be used royalty-free in games and commercial projects. | Generic library is unlikely to provide credible tennis strokes; service is not available to China-country-code accounts and supports humanoids only. |
| Custom modeled athlete | Maximum art control. | Highest skill/time requirement. |

### 6.3 Motion source

| Source | Best use | Main concern |
| --- | --- | --- |
| Purpose-recorded optical/inertial mocap | Highest-quality tennis footwork and racket timing. | Equipment/studio cost and cleanup remain. |
| Single-video AI mocap such as DeepMotion | Affordable prototype/base clips; exports FBX/BVH/GLB and supports custom humanoids. | Occlusion, racket/hand accuracy, foot slide, license tier, and source-video rights. Manual cleanup is mandatory. |
| Text-to-motion | Placeholder transitions and ideation. | Sports biomechanics and contact precision are not dependable enough for final strokes. |
| Hand-keyed animation | Fine control over contact and stylized motion. | Expensive for a full library; benefits from expert tennis reference. |

### Recommended V1 path

1. Use direct Three.js geometry for the exact court, net, ball, targets, and simple modular venue kit.
2. Run the standardized Tripo, Meshy, Lux3D, Hunyuan/VISVISE, Rodin, and licensed/commissioned opponent bake-off.
3. Record a real tennis player from useful angles with clear participant/source rights, using professional footage only as view-only reference unless a specific extraction license is documented.
4. Generate or capture initial motion via the winning rig/mocap route.
5. Retarget and clean every clip in Blender with tennis-expert review.
6. Add explicit ball-contact, opponent-hand, and normal/compact serve-rhythm metadata while keeping skeleton/racket socket conventions stable.
7. Export optimized GLB/KTX2 and validate technically, frame-by-frame, and under browser load/performance budgets.

## 7. Blender and MCP

Blender's own Lab now publishes a lightweight MCP server for Blender 5.1+. It can expose Blender's Python capabilities and documentation through natural-language tooling, but Blender explicitly warns that it executes LLM-generated code without guards and recommends a virtual machine or environment without sensitive data.

Use Blender MCP, if adopted, only as an isolated productivity aid for repetitive scene setup, naming, validation, and export experiments. It is not the asset source of truth and should not run with access to unrelated data. Generated changes still require Blender-side review, saved source files, and deterministic export presets.

Community Blender MCP projects exist and may integrate external generators. Do not install one solely because it has more features; perform source, license, network, telemetry, and arbitrary-code review first. The official Blender Lab option is the default evaluation candidate.

## 8. Future body tracking

MediaPipe Pose Landmarker for Web currently provides 33 pose landmarks in normalized image coordinates and 3D world coordinates. Google's web guide warns that video detection calls are synchronous and block the main thread, recommending Web Workers. This creates two immediate architecture requirements for a V2 spike:

- inference must be isolated from the render/simulation loop and measured for contention;
- tracking produces timestamped confidence-bearing frames/events through a narrow adapter.

Browser camera access through `getUserMedia()` requires a secure context and explicit user permission. The future feature should default to on-device processing, never start capture during normal V1 use, show a visible capture state, and define retention before any recording or upload is considered.

## 9. Key risks and experiments

| Risk | Earliest experiment | Pass evidence |
| --- | --- | --- |
| WebGPU path differs or regresses | Same one-court/one-opponent/one-ball scene on three renderer modes. | Browser matrix, screenshots, startup success, frame-time percentiles, and feature-gap log. |
| Ball feels wrong despite hitting targets | Compare solver traces and slow-motion renders with research/reference trajectories and coach review. | Numerical tolerance plus perceptual review; both must pass. |
| Contact looks disconnected | One forehand and one serve clip with explicit contact markers. | Frame-step string-bed/ball distance and normal-speed review. |
| 4K display drops frames | Adaptive pixel ratio/shadow/texture experiment on agreed reference hardware. | Stable frame pacing and acceptable visual comparison. |
| Physical scale feels wrong | Test calibrated versus immersive FOV on actual TV/projector setup. | Users correctly judge court/ball approach and select a documented default. |
| AI assets create cleanup/license debt | Run one asset through full provenance, cleanup, rig, export, and validation. | Time/cost record, license record, clean GLB, and accepted visual/contact review. |

## 10. Primary sources

### Rendering and browser platform

- [Three.js WebGPURenderer manual](https://threejs.org/manual/en/webgpurenderer)
- [Three.js WebGPURenderer API](https://threejs.org/docs/pages/WebGPURenderer.html)
- [Three.js loading 3D models](https://threejs.org/manual/en/loading-3d-models.html)
- [Three.js animation system](https://threejs.org/manual/en/animation-system.html)
- [Three.js DRACOLoader](https://threejs.org/docs/pages/DRACOLoader.html)
- [MDN WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Chrome WebGPU overview](https://developer.chrome.com/docs/web-platform/webgpu/overview)
- [React Three Fiber introduction](https://r3f.docs.pmnd.rs/getting-started/introduction)
- [Babylon.js WebGPU support source documentation](https://github.com/BabylonJS/Documentation/blob/master/content/setup/support/webGPU.md)
- [PlayCanvas graphics backends](https://developer.playcanvas.com/user-manual/graphics/)

### Tennis dimensions and dynamics

- [2026 ITF Rules of Tennis](https://www.itftennis.com/media/7221/2026-rules-of-tennis-english.pdf)
- [2026 ITF technical booklet](https://www.itftennis.com/media/15639/2026-technical-booklet.pdf)
- [Tennis ball trajectory decomposition based on spatiotemporal tracking data (2026)](https://link.springer.com/article/10.1007/s12283-026-00547-6)
- [ITF ball aerodynamics research summary](https://www.itftennis.com/media/2279/balls-ball-research.pdf)
- [Rapier determinism](https://rapier.rs/docs/user_guides/javascript/determinism/)
- [Rapier continuous collision detection](https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd/)

### Assets, animation, and future tracking

- [Blender glTF 2.0 export manual](https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html)
- [Blender Lab MCP server](https://www.blender.org/lab/mcp-server/)
- [Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)
- [Meshy auto-rigging and animation](https://help.meshy.ai/en/articles/16231707-how-to-create-3d-animation-with-auto-rigging)
- [Tripo developer API](https://developers.tripo3d.ai/en/)
- [DeepMotion Animate 3D documentation](https://www.deepmotion.com/doc/animate-3d)
- [MediaPipe Pose Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
- [MDN `getUserMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

External tool availability, pricing, terms, and browser support can change. Recheck them when accepting an ADR or spending money, not only when this research note is edited.
