# Cloud world generation and scene reconstruction: August 2026

- **Status:** Research complete; hands-on bake-off pending
- **Research date:** 2026-08-29
- **Owner constraints:** cloud inference only, self-hostable exported runtime assets, fewer high-value iterations, total initial asset/motion/environment bake-off under US$100

## 1. Conclusion

A generated 3D world can materially accelerate **venue art direction and environment production**, but it must not own the playable tennis coordinate system. The most credible V1 experiment is a layered scene:

```text
deterministic simulation coordinates
  -> exact procedural court, net, ball, targets, camera paths, and proxy colliders
  -> generated mesh or Gaussian-splat environment shell
  -> authored props, opponent, lighting, UI, and diagnostics
```

This preserves regulation dimensions, ball placement, camera calibration, collision/depth behavior, and user-selectable surfaces. It also lets a generated world provide architecture, seating, vegetation, fencing, and ambience without asking it to infer millimeter- or centimeter-accurate sports geometry.

The first cloud comparison should be **Aholo SpatialGen/Reality versus World Labs Marble**, with the existing procedural/modular venue plan as the control. Lux3D remains an object/asset generator within Aholo's product family; Aholo SpatialGen/Reality is the relevant whole-world product.

For V1's required live sun direction and day/night controls, an optimized **PBR mesh shell is the safer default**. Gaussian splats are a high-value visual experiment, especially for fixed ambience, but their appearance begins with captured/generated lighting baked into the splats. Relighting is possible with proxy geometry and specialized rendering, not equivalent to editing ordinary PBR materials.

## 2. What “world model” means in this project

Current products use the term for substantially different outputs:

| Class | Typical output | Useful here? |
| --- | --- | --- |
| Exportable 3D world generator | Gaussian splat, textured mesh, collider mesh, panorama, camera data | Yes; can become an authored environment asset. |
| Scene reconstruction service | Splat/mesh reconstructed from rights-cleared photos or video | Yes; useful if a real court can be captured with permission. |
| Interactive video world simulator | Server-generated frames responding to movement/input | No for V1 runtime; it does not expose the stable metric scene required by tennis simulation. |
| AI skybox/panorama generator | Equirectangular background with little or no usable geometry | Optional distant backdrop only. |
| World foundation model for robotics/video | Model weights or generated videos, often requiring substantial GPUs | Research watch list; incompatible with the cloud-only, sub-US$100 bake-off unless offered as an export service. |

“One click” is therefore plausible as an **authoring head start**. It does not imply that one opaque runtime file is smaller, faster, relightable, or more deterministic than modular assets.

## 3. Active cloud candidates

### 3.1 Aholo SpatialGen and Aholo Reality — Chinese-developed

[Aholo](https://www.aholo3d.com/en/) presents a spatial-intelligence platform spanning reconstruction, generation, editing, APIs, SDKs, and datasets. Its [OpenAPI page](https://www.aholo3d.com/solution/openapi) says object/space reconstruction accepts videos, images, and 360° video, while SpatialGen accepts a sentence or image and exposes task/project data including PLY files.

The [AI world tutorial](https://studio.aholo3d.com/resources/tutorials/how-to-create-3d-world-ai-spatial-gen) describes a single-image-to-panorama-to-3DGS workflow and PLY/SPZ export. The product also supports crop, measurement, annotations, browser viewing, and share/embed workflows. This makes it the best Chinese-developed cloud candidate for the requested environment experiment.

Tenmulate fit:

- Generate a venue shell from one of the approved concept frames, or reconstruct a rights-cleared real court from video.
- Export PLY or SPZ and ingest through a compatible web splat renderer.
- Calibrate scale with the regulation court width/length, crop or mask the generated playing rectangle, and overlay the exact code-owned court.
- Use the environment for stands, walls, vegetation, fencing, ceiling/roof, and baked ambience—not ball collision or shot coordinates.

Unknowns that block production selection:

- Public pricing did not expose usable plan values in this research pass; only a free trial was visible.
- Commercial output rights, storage/retention, API egress, and redistribution rights must be captured from the actual account terms before uploading source media or shipping an export.
- The documented world export is PLY/SPZ rather than a production-ready PBR GLB. Dynamic relighting and mesh conversion quality need direct testing.

### 3.2 World Labs Marble — international

[Marble](https://www.worldlabs.ai/blog/marble-world-model) generates and edits explorable worlds from text, image, multi-image, panorama, and—on paid plans—video. It exports Gaussian splats, video, coarse collider meshes, and high-quality meshes.

Its current export documentation is unusually concrete:

- Splats: full or low-resolution SPZ/PLY.
- Collider mesh: GLB, roughly 100–200k triangles and typically 3–4 MB.
- High-quality mesh: GLB around 600k textured triangles or about 1M vertex-colored triangles, typically 100–200 MB, generated offline.
- Coordinate conversion is documented because exports use an OpenCV-oriented frame.

The [current pricing page](https://marble.worldlabs.ai/pricing) lists Free at US$0, Standard at US$20/month, Pro at US$35/month, and Max at US$95/month. Pro adds high-resolution textured-mesh export and commercial rights, so **one month of Pro at US$35 is the appropriate paid environment bake-off**, not Max.

Marble also explicitly recommends [Spark](https://github.com/sparkjsdev/spark) for custom Three.js web applications. This is a strong integration story, but the currently documented Spark constructor takes a `THREE.WebGLRenderer`; compatibility with the proposed `WebGPURenderer` path is not assumed.

### 3.3 Procedural/PBR control

The control is not another AI model. It is the existing code-owned court plus a small modular venue kit, with cloud-generated or licensed props where useful. It establishes:

- the smallest transfer and best lighting configurability;
- exact surface swapping across every venue shell;
- a measurable baseline for authoring time and visual quality;
- a safe fallback if both world generators create artifacts or unmanageable payloads.

## 4. Watch list and non-candidates

| Product/research line | Current evidence | Tenmulate position |
| --- | --- | --- |
| **Tencent HY-World 2.0 / HunyuanWorld** | Tencent's official research describes generated/reconstructed 3DGS worlds and mesh export. The publicly verified route is open model code/weights. | Chinese technology watch list only. Owner has ruled out local inference; add only if a first-party or approved managed export service becomes verifiable. |
| **Google DeepMind Genie 3 / Project Genie** | Real-time 720p interactive generated worlds at roughly 20–24 fps, with limited-duration interaction. | Not an asset pipeline: no stable self-hostable mesh/splat export contract is documented. Useful inspiration, not a V1 dependency. |
| **Odyssey-2** | Server-streamed, frame-by-frame interactive video simulations with multi-minute sessions. | Not a deterministic 3D environment layer; no exportable scene/coordinate contract was found. |
| **NVIDIA Cosmos** | Text/image/video-to-world foundation models focused on physical-AI video and substantial datacenter GPUs. | Outside the cloud-service budget and does not solve runtime scene export. |
| **Blockade Labs Skybox AI** | Fast production-ready 360° environment/sky generation. | Useful only as a distant sky/backdrop candidate; it cannot supply the court, colliders, seating geometry, or metric camera space. |

This classification is deliberate: a world that only generates the next video frame cannot be trusted to preserve ball occlusion, the net plane, a baseline position, or the same seeded replay.

## 5. Runtime integration paths

### 5.1 Exported mesh shell

```text
cloud world generation
  -> textured GLB or source mesh
  -> Blender scale/orientation/crop/cleanup
  -> decimate + UV/PBR repair + LODs + KTX2
  -> validated venue GLB on project CDN
  -> Three.js scene beside the exact court
```

Benefits:

- conventional depth, shadows, occlusion, material editing, and live lighting;
- compatible with the proposed WebGPU/WebGL renderer comparison;
- easier day/night and sun-direction control;
- straightforward proxy/collision geometry.

Costs:

- generated high-quality meshes may be hundreds of thousands of triangles and 100–200 MB before optimization;
- cleanup, holes, UVs, baked lighting, and invented rear geometry can be substantial;
- the generated court center must still be removed or hidden.

### 5.2 Gaussian-splat shell

```text
cloud SpatialGen/reconstruction
  -> PLY or SPZ
  -> crop, compress, and generate a proxy/collider mesh
  -> register both assets to court coordinates
  -> render the splat as the visual shell
  -> use exact meshes for court, net, opponent, ball, props, depth, and collisions
```

[Spark](https://github.com/sparkjsdev/spark) is built by World Labs and integrates splats with Three.js scene objects. It accepts PLY, SPZ, SPLAT, KSPLAT, and SOG, supports depth testing, and documents desktop budgets of roughly 1–5 million splats as a starting rule of thumb. It currently centers on `THREE.WebGLRenderer`, so the splat spike is a separate renderer row rather than a free addition to the WebGPU path.

[PlayCanvas](https://developer.playcanvas.com/user-manual/gaussian-splatting/) provides the more complete browser-native splat stack: WebGPU GPU sorting, WebGL worker sorting, LOD/streaming, SOG compression, SuperSplat editing, shadows, proxy-mesh physics, and proxy-based relighting. It becomes a serious engine alternative only if splat environments outperform the mesh route enough to justify revisiting ADR-0001.

Important limitations:

- splat scenes begin with lighting baked in;
- transparent sorting, depth composition, fast camera motion, and 4K fill rate must be measured;
- splats cannot be the physics/collision authority;
- correct relighting and received shadows require a proxy mesh and extra passes;
- a single high-resolution splat may cost more transfer and GPU work than a modular PBR venue.

### 5.3 Provider-hosted embed

Do not use a provider iframe or vendor viewer for V1 gameplay. It would split camera/depth control, compromise deterministic replay and offline behavior, and make runtime availability dependent on the generation vendor. Export, validate, version, and host the selected asset under the project's own immutable asset origin.

## 6. Court registration contract

Every generated environment must ship with a `VenueEnvironmentV1` record containing:

- representation: `mesh`, `splat`, or `procedural`;
- source axes/units and a baked `worldToCourt` 4×4 transform;
- source and runtime bounds;
- net-center, near/far baseline-center, and sideline registration anchors;
- scale error at known 23.77 m length and 10.97 m doubles width;
- visual-mask/crop volume for the exact playing rectangle;
- proxy/collider/depth mesh URL and hash where required;
- lighting mode: `pbr-live`, `baked`, or `proxy-relit`;
- allowed sun/time controls and required baked variants;
- byte size, splat/triangle count, LODs, cache group, license, and provenance.

The scene uses Tenmulate's existing SI frame: court center under the net at `(0, 0, 0)`, `+x` to the near player's right, `+y` upward, and `+z` toward the opponent. A generator's coordinates are never allowed to leak into ball, camera, opponent-contact, or drill data.

## 7. Venue/surface matrix

V1 should build three independently selectable venue shells and three code-owned surface appearances:

| Venue shell | Required lighting behavior | Surfaces |
| --- | --- | --- |
| Outdoor court complex | Sun azimuth/elevation, daylight/night presets, floodlights | Hard, clay, grass |
| Indoor club hall with enclosing walls | Fixture intensity/color plus optional window/skylight daylight influence | Hard, clay, grass |
| Indoor stadium | Arena-light presets, intensity/color, optional roof/daylight influence | Hard, clay, grass |

This yields all nine requested combinations without downloading nine fully duplicated worlds. Each shell includes spectator seating without crowd models, access context, an umpire chair, and player rest seating. Exact court surface, net, umpire chair, and near-court safety-critical props remain replaceable meshes even if the surrounding shell is generated.

## 8. Sub-US$100 bake-off

No purchase is made by this plan. Proposed maximum allocation:

| Lane | Cap | Plan |
| --- | ---: | --- |
| World environment | US$35 | One month of Marble Pro for commercial-rights and HQ-mesh export testing. Test Aholo on free/trial access until its actual checkout price and terms are recorded. |
| Character geometry | US$20 | Small Tripo and Meshy credit pools; test Lux3D with available introductory access. |
| Motion | US$30 | One month each of Rokoko Basic (US$12 monthly) and Move One Starter (US$18/month), while using DeepMotion/Plask free tiers for comparison. |
| Contingency | US$14 | Only after a failed test has a specific, documented retry hypothesis. |
| **Maximum** | **US$99** | Hard stop; no automatic subscription renewal. |

If Aholo requires payment, replace an inferior lane or request a revised cap; do not silently exceed US$99.

## 9. Bake-off evidence

Use the same approved outdoor-hard-court concept input for Aholo and Marble, then compare:

1. Time and paid cost from input to export.
2. Six-DOF consistency from the near baseline, corners, net, and overhead positions.
3. Registration error against the exact court.
4. Ability to remove/cover the generated playing surface.
5. Mesh/splat/proxy quality and repair time.
6. Live sun/day/night behavior and opponent/ball shadow integration.
7. Cold bytes, decode time, first useful frame, warm cache, GPU memory, and 1% frame-time lows at 1080p and 4K.
8. WebGPU/WebGL compatibility, browser fallbacks, and depth/occlusion defects.
9. Commercial rights, redistribution, input retention, and provenance completeness.

## 10. Primary sources

- [Aholo platform](https://www.aholo3d.com/en/)
- [Aholo OpenAPI capabilities](https://www.aholo3d.com/solution/openapi)
- [Aholo AI-generated worlds](https://www.aholo3d.com/feature/ai-generated-3d-worlds)
- [Aholo SpatialGen workflow and export](https://studio.aholo3d.com/resources/tutorials/how-to-create-3d-world-ai-spatial-gen)
- [World Labs Marble overview](https://www.worldlabs.ai/blog/marble-world-model)
- [Marble export file specifications](https://docs.worldlabs.ai/marble/export/specs)
- [Marble mesh export](https://docs.worldlabs.ai/marble/export/mesh)
- [Marble pricing](https://marble.worldlabs.ai/pricing)
- [Spark Three.js renderer](https://github.com/sparkjsdev/spark)
- [Spark performance guidance](https://sparkjs.dev/docs/performance/)
- [PlayCanvas Gaussian splatting](https://developer.playcanvas.com/user-manual/gaussian-splatting/)
- [PlayCanvas splat rendering architecture](https://developer.playcanvas.com/user-manual/gaussian-splatting/rendering-architecture/renderers/)
- [PlayCanvas relighting](https://developer.playcanvas.com/user-manual/gaussian-splatting/building/relighting/)
- [Tencent HunyuanWorld-1.0 and later research links](https://github.com/Tencent-Hunyuan/HunyuanWorld-1.0)
- [Google DeepMind Genie 3](https://deepmind.google/models/genie/)
- [Odyssey world models](https://odyssey.ml/)
- [NVIDIA Cosmos](https://docs.nvidia.com/cosmos/latest/)
- [Blockade Labs Skybox AI](https://www.blockadelabs.com/)

Pricing, features, service terms, and renderer support can change. Recheck them at the moment of spend and again before shipping any derived asset.
