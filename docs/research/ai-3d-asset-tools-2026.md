# AI 3D asset and animation tools: August 2026 market map

> **Direction update (2026-08-30):** Character/world generation findings are retained as historical market research. Production now uses code-owned Three.js venues and a neutral, faceless, rights-cleared humanoid GLB. The cloud mocap, retargeting, rigging, cleanup, Blender, licensing, and web-optimization findings remain active.

- **Status:** Research complete; hands-on bake-off pending
- **Research date:** 2026-08-29
- **Scope:** Chinese-developed and international text/image/video-to-3D, topology, materials, segmentation, rigging, animation, Blender, API, MCP, and Codex workflows
- **Owner constraints added 2026-08-29:** no local inference models; cloud generation/mocap only; few-shot iteration; complete initial world/character/motion bake-off below US$100

## 1. Executive conclusion

There is no dependable single-button system that should be trusted to turn a tennis reference into a final game-realistic, web-optimized, correctly rigged opponent with biomechanically credible strokes. Current products cover different parts of a four-stage production chain:

1. **Shape and appearance:** text/image/multiview to mesh or Gaussian representation, textures, and PBR materials.
2. **Production preparation:** part separation, retopology, UVs, LODs, mesh cleanup, material baking, and web-size optimization.
3. **Character preparation:** skeleton creation, bone placement, skin weights, sockets, and retarget compatibility.
4. **Motion:** preset animation, text-to-motion, video/markerless mocap, retargeting, and manual tennis cleanup.

The strongest initial Tenmulate comparison is:

- **Tripo:** broad Chinese cloud pipeline, low transparent API task prices, official Blender extension, and official but alpha MCP.
- **Meshy:** broad international cloud pipeline with the clearest mature Blender + official MCP/Codex story.
- **Lux3D:** very new Chinese generator with material emphasis and a first-party Harness Mode explicitly described for Codex batch generation and Blender refinement; production details and character capabilities still need verification.
- **Tencent Hunyuan3D Cloud + VISVISE:** strong modular Chinese hosted candidate if access and pricing fit the cap; Hunyuan covers mesh/PBR and VISVISE covers topology, LOD, rigging, skinning, video/text motion, and pose.
- **Hyper3D Rodin + a motion specialist:** strong high-fidelity/controlled geometry candidate, then VISVISE, DeepMotion, Rokoko, or Move.ai for tennis motion.
- **Licensed/commissioned character + captured tennis motion:** quality/control baseline that every generated route must beat after cleanup time is counted.

The recommended runtime remains independent of all of them: create assets during development, finish and validate them in Blender, export optimized GLB, and ship those files from static/CDN storage. End users should not call an AI 3D service while practicing in V1.

The active bake-off now excludes all local-model routes even where they remain useful market references below. It adds Aholo SpatialGen/Reality and World Labs Marble for complete environment shells; see [Cloud world generation and scene reconstruction](world-generation-and-scene-reconstruction-2026.md). The character-to-motion binding contract is in [Mocap to web opponent](mocap-to-web-character-pipeline.md).

## 2. What “Blender/Codex integration” actually means

Three different integrations are easy to conflate:

| Integration | What it does | Runtime consequence |
| --- | --- | --- |
| Vendor Blender extension | Generates/imports an asset from inside Blender or sends a web result into Blender. | Development convenience only. The shipped app still receives a reviewed GLB. |
| Vendor API/MCP/agent skill | Lets Codex or another agent create/poll/download generation jobs. | Development automation only unless deliberately embedded in the public product, which V1 will not do. |
| Blender MCP | Lets an agent inspect and operate an open Blender scene through Blender's Python/API surface. | Local production automation only; it is neither the renderer nor an asset generator by itself. |

[Blender's official MCP server](https://www.blender.org/lab/mcp-server/) requires Blender 5.1+, an add-on, an MCP server, and an LLM client. Blender warns that generated code runs without guards. Any evaluation must use a clean, isolated workstation/VM, source control, saved `.blend` files, explicit cost confirmations, and no unrelated credentials or sensitive data.

### Integration comparison for the three requested tools

| Tool | Blender | Codex/agent path | Current assessment |
| --- | --- | --- | --- |
| **Tripo** | [Official MIT-licensed Blender extension](https://github.com/VAST-AI-Research/tripo-3d-for-blender) for text/image/multiview generation, PBR/face settings, task progress, and import. | [Official Tripo MCP](https://github.com/VAST-AI-Research/tripo-mcp) connects natural-language generation to the Blender add-on. It is explicitly labeled alpha and its quick start names Claude/Cursor; Codex compatibility must be tested rather than assumed from protocol support. | Strong integrated candidate, but pin versions and treat MCP as experimental. Direct API/SDK remains the more deterministic batch route. |
| **Meshy** | [Official Blender integration](https://www.meshy.ai/integrations) transfers untextured, PBR, rigged, and animated assets and includes analysis/cleanup/export tools. | [Official Meshy MCP](https://www.meshy.ai/tutorials/meshy-mcp-guide) explicitly lists Codex, exposes generation/texturing/rigging/animation, and can be paired with Blender MCP. | Clearest first-party Codex + Blender workflow of the three. Paid API tasks consume the normal Meshy credit pool. |
| **Lux3D** | The launch describes refinement in Blender, but no first-party native Blender extension was found in the public material reviewed. Aholo exposes API documentation and an Agent Skill entry point. | [Manycore's 2026-08-27 launch](https://www.prnewswire.com/news-releases/manycore-tech-unveils-lux3d-and-an-explicit-3d-path-to-world-models-302861778.html) says Harness Mode supports batch generation using tools such as OpenAI Codex, followed by Blender refinement. | Promising and unusually direct for Codex, but only two days old at this research date. Verify export formats, mesh topology, licensing, pricing, agent-skill packaging, and whether “Blender refinement” is import/export or a maintained extension. |

## 3. Chinese-developed options

“Chinese-developed” refers to product/team origin, not necessarily the current contracting entity or data-processing region. Contract, storage, and governing-law terms must be checked for the actual account and endpoint.

### 3.1 Primary candidates

| Tool | Demonstrated scope | Deployment/cost snapshot | Tenmulate fit and caveats |
| --- | --- | --- | --- |
| **Tripo / VAST (Beijing)** | Text, image, and multiview to 3D; PBR textures; parts; retopology; segmentation; completion; rig check; auto-rig; animation retarget; GLB output. The [official API price table](https://developers.tripo3d.com/en/pricing) exposes the whole chain. | Cloud web/API plus official Blender/MCP/SDKs. On 2026-08-29, 100 credits = US$1; standard textured image-to-3D is 30 credits, auto-rig 25, and animation retarget 10 per clip. Repeated generations and cleanup dominate real asset cost. | Best Chinese one-stop bake-off route. Test athlete anatomy, part separation, rig consistency, clothing deformation, and whether tennis clips retarget cleanly. |
| **Lux3D / Manycore (Hangzhou)** | Text/image to explicit 3D assets; Standard mode emphasizes precision/materials, Turbo targets generation in as little as 20 seconds, Harness targets batch creation. Material response is a stated focus. | Cloud/API/Harness; pricing and production API details were not publicly verifiable in this pass. [Aholo's official site](https://www.aholo3d.com/en/) links API Documentation and an Agent Skill. | Must test because of first-party Codex/Blender positioning. Currently a static-asset candidate: the launch says dynamic components/motion logic are planned, so do not assume segmentation, rigging, skinning, or animation today. |
| **Tencent Hunyuan3D** | Tencent Cloud offers text/image/eight-view generation, topology optimization, component generation, UVs, and materials. [Hunyuan3D 2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) releases local image-to-shape and production-oriented PBR texture code/weights. | Cloud API or local. Tencent Cloud listed RMB0.09–0.12 per credit in its [current product pricing](https://cloud.tencent.com/product/ai3d), with operation-specific credit consumption. Local 2.1 reports about 10 GB VRAM for shape, 21 GB for texture, and 29 GB for both. | Use only the hosted route under the owner decision. Pair with VISVISE or another hosted rig/motion tool; review territory and output terms. |
| **Tencent Games VISVISE** | Its [official SDK](https://github.com/tencent-visvise/visvise-sdk-go/blob/main/README_EN.md) exposes image-to-high/mid/low model, mesh refine, retopology, LOD, UV, texture, rigging, skinning, video-to-animation, text-to-animation, image-to-pose, and 2D segmentation. | Service/OpenAPI with assigned credentials; public self-serve pricing was not found. SDK code is MIT, but service terms and asset licenses remain separate. | Most strategically relevant Chinese production pipeline for a tennis character. It can complement Lux3D/Hunyuan/Rodin or be tested end to end. Access/onboarding and tennis-motion quality are the unknowns. |
| **Hyper3D Rodin / Deemos (Shanghai/global)** | Text/image/multiview generation, PBR, Smart Low-Poly, high-poly normals, UV-ready outputs, control inputs, texturing, ChatAvatar, DCC plugins, and API. | Cloud. [Current pricing](https://hyper3d.ai/pricing) starts Creator at US$30/month and Business/API at US$120/month; direct credits are US$1.50 and base Gen-2.5 is documented at 0.5 credit before add-ons. Enterprise offers on-premise. | Strong hero-character and prop candidate. Public material is clearer on geometry/materials than full-body tennis rigging/motion; pair with a specialist and validate character terms. |

### 3.2 Open/local and watch-list options

These are research context only. They will not be installed or run under the owner's cloud-only authoring decision.

| Tool | Role | Caveat |
| --- | --- | --- |
| **Step1X-3D / StepFun** | Apache-2.0 [open image-to-textured-3D research code](https://github.com/stepfun-ai/Step1X-3D); useful local comparison for geometry/material control. | Not an end-to-end character production service; budget setup, retopology, rigging, and animation separately. |
| **TripoSG / TripoSF / UniRig / AniGen** | VAST's open research family spans high-fidelity shape, arbitrary topology, and learned rigging/animatable assets. | Research components may not match the hosted product's stability, license, UI, or Windows ease. Use as targeted local experiments, not as a presumed production bundle. |
| **NetEase AI Lab** | Research covers video mocap, face/head reconstruction, face rig/skinning, and animation. | Public consumer/API availability and commercial onboarding are unclear; retain as an enterprise/research watch list, not a V1 dependency. |

## 4. Options developed in other regions

### 4.1 Asset generation and preparation

| Tool | Demonstrated scope | Fit and caveats |
| --- | --- | --- |
| **Meshy (US)** | Text/image/multiview to 3D, PBR texturing, remesh/processing, auto-rigging, animation presets/text-to-motion, GLB/FBX, official Blender and MCP/Codex integrations. [API pricing](https://docs.meshy.ai/en/api/pricing) currently lists 30 credits for textured Meshy-6 image-to-3D, 5 for auto-rigging, and 3 per animation. | Best international end-to-end comparison to Tripo. Free outputs are CC BY 4.0 under current terms; use a paid/private commercial plan for production candidates and archive the governing terms. |
| **Sloyd (Norway)** | Parametric AI for props/buildings with clean topology, editable sliders, prompt control; generative text/image/multiview; GLB/FBX/OBJ/STL; plugins and API. [Official docs](https://sloyd.gitbook.io/documentation) emphasize optimized game-ready assets. | Excellent for modular venue props, benches, umpire chair, walls, lights, and hard-surface iteration. Not the primary opponent-athlete solution. |
| **Kaedim (UK/US operations)** | AI plus human quality-control pipeline from reference images to optimized geometry, UVs, textures, LODs, and optional rigs. [Game-ready docs](https://docs.kaedim3d.com/kaedim-co-creation/game-ready-assets) describe staged approval/revision. | Higher-control studio route and useful quality baseline, but [current Indie pricing](https://www.kaedim3d.com/plans) is US$400/month and turnaround is not instant. |
| **Stability AI SPAR3D** | [Open single-image reconstruction](https://github.com/Stability-AI/stable-point-aware-3d) with material improvements, editable point conditioning, GLB, and remeshing. | Local/offline static geometry comparison; about 10.5 GB VRAM default or roughly 7 GB low-VRAM. No complete humanoid rig/motion pipeline. Review the Stability community license and revenue threshold. |
| **Microsoft TRELLIS.2** | MIT-licensed [local image-to-PBR-GLB and texture generation](https://github.com/microsoft/TRELLIS.2) with remesh, decimation, and UV tooling. | Strong research/local geometry benchmark; substantial GPU/setup cost and no turnkey character rig/motion production. |

### 4.2 Rigging and tennis-motion specialists

| Tool | Demonstrated scope | Fit and caveats |
| --- | --- | --- |
| **DeepMotion Animate 3D (US)** | Browser video-to-motion for body/face/hands/multiple people, custom characters, and FBX/BVH/GLB. [Official pricing](https://www.deepmotion.com/pricing-animate3d) starts at US$9/month annually for a commercial tier. | Low-cost first tennis-mocap comparison. Expect foot, racket-hand, occlusion, contact, and root-motion cleanup. |
| **Rokoko Vision/Create (Denmark)** | Single-video and text-to-motion, cleanup/retarget in Rokoko Studio, FBX/BVH. [Vision 3.0](https://www.rokoko.com/products/vision) provides 30 seconds/month free and a US$10/month annual Basic plan with 600 seconds. | Strong affordable capture/edit loop. Finger tracking was not included at Vision 3.0 launch; racket/toss detail needs manual work or hardware capture. |
| **Move.ai (UK)** | Move One single-camera iPhone capture; API priced per second; Genesis multi-camera on-prem NVIDIA system aims at optical-quality markerless data. [Move API pricing](https://developers.move.ai/docs/pricing/) is explicit. | Compare when serve/footwork quality exceeds budget tools. Genesis is a studio/on-prem option, not a casual local pipeline. |
| **Autodesk Flow Studio (US)** | Video-driven character replacement/mocap/camera tracking and editable 3D scene exports; 2026 added 3D editor/canvas and text/image character generation. | Useful if tennis reference video, camera solve, and character replacement are evaluated together; more film/VFX-oriented than web game asset production. |
| **Adobe Mixamo (US)** | Free humanoid auto-rig/preset library with commercial game use under the [current FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html). | Excellent prototype skeleton/transition baseline, but generic motions are not credible tennis strokes and the service is unavailable to China-country-code Adobe IDs. |
| **Anything World (UK)** | Processing API and plugins for automatic rigging/animation of humanoids, animals, and other models; text/image generation endpoints also exist. | Useful rigging comparison, but its docs call parts of Animate Anything experimental; validate skeleton and deformation before depending on it. |

## 5. Cloud production versus local production

### Cloud authoring

Reference images/video or prompts are uploaded through a website, API, Blender extension, MCP server, or agent skill; the vendor runs inference on its GPUs and returns model/motion files.

Advantages:

- no large local GPU purchase or model installation;
- fast access to current hosted models and elastic batch jobs;
- simpler early comparisons and often lower cost for a small asset library;
- polished retopology/rigging/motion features may be available in one account.

Costs and risks:

- recurring credits/subscriptions and potentially expensive iteration;
- input/output retention, training-use, location, and participant-consent concerns;
- service/version changes, queueing, outages, and vendor lock-in;
- commercial-output rights may differ by plan and can change;
- an API/Blender/MCP integration can spend credits repeatedly unless every paid action is confirmed.

### Local authoring

Local inference is not an active Tenmulate option. The comparison is retained to explain the tradeoff and to avoid confusing local Blender finishing with local model execution.

Weights and inference code run on a project-controlled workstation or server, with Blender finishing locally.

Advantages:

- stronger data custody, reproducibility, version pinning, and batch control;
- no per-call fee after hardware/electricity/operations;
- the pipeline can keep working if a vendor UI/API changes.

Costs and risks:

- meaningful NVIDIA VRAM, disk, setup, compile, and maintenance requirements;
- Windows support may be experimental and CPU inference impractical;
- local does not remove license restrictions or asset cleanup;
- hosted products may be materially newer/better than their open releases.

### The key architectural point

Cloud versus local changes **how the development team produces assets**, not how a player's browser renders them. Both routes should end at the same gate:

```text
licensed input/concept
  -> generator or base asset
  -> retopology/parts/UV/PBR
  -> rig/skin and tennis motion
  -> Blender cleanup + contact metadata
  -> optimized, validated GLB + KTX2 textures
  -> immutable CDN/static cache
  -> Three.js runtime
```

Therefore generator compute and mocap subscriptions are development costs. V1 user sessions incur normal static asset delivery—not one AI generation call per player. A runtime generator API would be a separate future product feature with very different cost, safety, latency, moderation, and licensing requirements.

### Accepted cloud-only budget envelope

- Up to US$35: World Labs Marble Pro environment export; Aholo stays on free/trial access until actual terms and checkout price are captured.
- Up to US$20: Tripo and Meshy character generation; Lux3D introductory/free access unless its current price is verified.
- Up to US$30: Rokoko Basic plus Move One Starter; DeepMotion and Plask free comparisons.
- Up to US$14: hypothesis-driven contingency.
- Hard maximum: US$99 with automatic renewal disabled.

## 6. Direct Three.js geometry, GLB, and procedural modeling

### Direct/code-generated Three.js is the right choice for

- regulation court slab, lines, service boxes, net dimensions, ball, target zones, trajectory trails, and debug geometry;
- parametric color/surface themes and training markers;
- simple modular venue elements where exact dimensions and tiny payloads matter;
- deterministic visual tests and easy runtime customization.

### It is the wrong primary tool for

- a game-realistic human athlete, face, hair, layered clothing, skin weights, joint deformation, and racket-hand detail;
- manually cleaned normal/compact serve mechanics and tennis footwork;
- high-quality UV/material baking and reusable authored animation clips.

Three.js is the renderer and scene runtime, not a replacement for sculpting, retopology, rigging, weight painting, or animation tooling. Generating a humanoid vertex-by-vertex in application code would create maintenance and quality debt without reducing the final GPU cost.

### Recommended hybrid

- **Code-own:** court, lines, net frame/mesh, ball, targets, trajectory/debug layers, simple venue kit.
- **GLB-own:** skinned opponent appearances, rackets, detailed umpire chair/benches/venue props if needed, and animation clips.
- **Blender-own:** editable production truth for every complex asset, even when the starting mesh came from Tripo, Meshy, Lux3D, Hunyuan, Rodin, a scan, or an artist.
- **Data-own:** shot physics, contact markers, opponent-hand/rhythm metadata, camera paths, and drill timelines in versioned application schemas.

## 7. Web asset delivery and performance

Hosting a large GLB on the same static deployment is technically possible, but it couples app deploys to asset churn and can waste first-load bytes. For the remaining neutral humanoid and animation assets, prefer:

- a small critical application plus the code-owned scene modules;
- immutable hashed asset manifests;
- separate opponent mesh and animation bundles loaded by selected drill;
- KTX2/Basis GPU texture compression and measured meshopt/Draco geometry compression;
- 1K/2K defaults with higher texture/LOD variants selected by the quality benchmark;
- long-lived CDN/object caching and service-worker caching for user-selected offline drills;
- graceful storage-quota and missing-asset UX.

Provisional spike budgets, not release promises:

- critical application/UI/procedural-court route: at most 5 MiB compressed;
- first neutral humanoid plus one useful drill: at most 15 MiB additional transfer;
- additional motion families: lazy-loaded and cached, with measured cold/warm timings.

glTF is designed for runtime transmission and Blender exports skinning/animation. [KTX2/Basis](https://www.khronos.org/gltf/) reduces texture transfer and GPU memory across platforms. Exact limits must come from the real neutral-humanoid and motion bake-off, not from provider marketing.

## 8. Standardized bake-off

### Routes to test

1. **Tripo end to end:** multiview character -> parts/retopo -> auto-rig -> retarget -> Blender.
2. **Meshy end to end:** multiview character -> smart topology/PBR -> auto-rig/preset -> Blender.
3. **Lux3D + specialist:** Lux3D Standard/Turbo geometry/material -> Blender -> VISVISE or motion specialist.
4. **Hunyuan3D Cloud + VISVISE:** hosted Hunyuan geometry/PBR -> VISVISE retopo/LOD/rig/skin/video motion -> Blender, only if self-serve access and total pricing fit the cap.
5. **Rodin + specialist:** controlled multiview character -> low-poly/PBR -> VISVISE/DeepMotion/Rokoko -> Blender.
6. **Licensed/commissioned baseline:** commercial game-ready humanoid -> same captured tennis clips -> Blender.

### Identical test inputs

- One rights-cleared front/side/back character concept or multiview reference.
- One five-to-ten-second forehand with visible feet, hips, shoulders, racket, and contact.
- One normal high-toss serve and one compact low-toss serve, filmed with the same capture protocol.
- One left-handed conversion/clip requirement.

### Scored outputs

| Dimension | Evidence |
| --- | --- |
| Visual fit | Approved turntable and in-court renders under identical lighting. |
| Geometry | Triangle count, topology flow, holes/non-manifold geometry, separate parts, UVs, LODs. |
| Materials | PBR maps, seams, texture sizes, compression artifacts, court-lighting response. |
| Rig/skin | Skeleton consistency, joint placement, deformation at shoulders/elbows/hips/knees/wrists, racket socket. |
| Motion | Foot slide, root drift, racket/contact distance, toss and trophy timing, left-hand validity, loop/blend quality. |
| Web runtime | GLB/KTX2 bytes, decode/load time, CPU/GPU frame time, memory, WebGPU/WebGL parity. |
| Production cost | Subscription/credits, failed generations, active human cleanup hours, total elapsed time. |
| Rights/operations | Input consent, output license, privacy/retention, region, provider/model version, reproducibility. |
| Integration | Blender round trip, API determinism, MCP/Codex version/security, cost confirmation, logs without secrets. |

No route wins on screenshot quality alone. The winner minimizes total accepted-asset cost after Blender cleanup and browser validation.

## 9. Recommended sequence

1. Approve one game-realistic character concept and a capture pack whose download, upload, derivative-motion, likeness, and commercial rights are documented.
2. Test **Tripo, Meshy, and Lux3D first**, because the owner named them and each exposes a distinct agent/Blender story.
3. Test **Hunyuan3D Cloud + VISVISE** only if hosted access and pricing are verifiable; do not install the local models.
4. Keep **Rodin + DeepMotion/Rokoko** and a licensed humanoid as quality baselines.
5. Do not install any MCP/plugin until its repository, publisher, requested credentials, network destinations, telemetry, arbitrary-code surface, and credit behavior are reviewed.
6. Promote only an optimized GLB that passes provenance, rig, contact, visual, load, and frame-time gates.

## 10. Decisions still needed

- Exact paid tiers after their checkout total, commercial-output rights, renewal behavior, and retention terms are visible.
- Exact footage source: purpose-recorded and released performance, or a specifically licensed professional clip covering download, cloud upload, derivative motion, likeness, and commercial use.
- Visual references for opponent face/body/apparel realism.
- Whether V1 requires two distinct body/appearance meshes or appearance variants on one skeleton.
- First coach/advanced-player biomechanics reviewer.

## 11. Source index

### Chinese-developed

- [Tripo API pricing and operation map](https://developers.tripo3d.com/en/pricing)
- [Tripo official Blender extension](https://github.com/VAST-AI-Research/tripo-3d-for-blender)
- [Tripo official MCP](https://github.com/VAST-AI-Research/tripo-mcp)
- [Lux3D launch and Harness/Codex/Blender workflow](https://www.prnewswire.com/news-releases/manycore-tech-unveils-lux3d-and-an-explicit-3d-path-to-world-models-302861778.html)
- [Aholo/Lux3D platform](https://www.aholo3d.com/en/)
- [Tencent Hunyuan3D Cloud](https://cloud.tencent.com/product/ai3d)
- [Hunyuan3D 2.1 local repository](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1)
- [Tencent VISVISE SDK](https://github.com/tencent-visvise/visvise-sdk-go/blob/main/README_EN.md)
- [Hyper3D Rodin](https://hyper3d.ai/)
- [Hyper3D pricing](https://hyper3d.ai/pricing)
- [Step1X-3D](https://github.com/stepfun-ai/Step1X-3D)

### Other regions and standards

- [Meshy integrations](https://www.meshy.ai/integrations)
- [Meshy official MCP guide](https://www.meshy.ai/tutorials/meshy-mcp-guide)
- [Meshy API pricing](https://docs.meshy.ai/en/api/pricing)
- [Sloyd documentation](https://sloyd.gitbook.io/documentation)
- [Kaedim game-ready assets](https://docs.kaedim3d.com/kaedim-co-creation/game-ready-assets)
- [DeepMotion Animate 3D](https://www.deepmotion.com/doc/animate-3d)
- [Rokoko Vision 3.0](https://www.rokoko.com/products/vision)
- [Move.ai products](https://move.ai/products)
- [Autodesk Flow Studio 3D Editor](https://blogs.autodesk.com/media-and-entertainment/2026/08/04/introducing-3d-editor-canvas-in-autodesk-flow-studio/)
- [Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)
- [Anything World processing API](https://anything-world.gitbook.io/anything-world/api/rest-api-references)
- [SPAR3D](https://github.com/Stability-AI/stable-point-aware-3d)
- [Microsoft TRELLIS.2](https://github.com/microsoft/TRELLIS.2)
- [Blender glTF 2.0 manual](https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html)
- [Blender MCP](https://www.blender.org/lab/mcp-server/)
- [Khronos glTF/KTX2](https://www.khronos.org/gltf/)

Prices, feature sets, models, terms, and integrations can change quickly. Recheck the official page immediately before purchasing credits, uploading reference media, installing a connector, or accepting a production asset.
