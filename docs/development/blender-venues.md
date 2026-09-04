# Blender-authored venues

The hard-open arena is an original Rod Laver-inspired architectural study with a blue playing area and green surrounds. It is available for review before replacing the default procedural venue. Exact gameplay court dimensions remain in `src/domain/court.ts`; Blender owns the visible court, net, furniture, bowl and roof. Runtime lighting, atmosphere, opponent and trajectories remain in Three.js.

## Local tools

Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/blender/setup.ps1` from the repository. The setup downloads the official **Blender 5.2.1 LTS Windows portable** archive, verifies its published SHA-256, and installs it under the ignored `.tools/` directory. This bypasses the Microsoft Store executable's CLI access restriction. A project-specific Blender profile is used; normal Blender preferences are untouched.

The official Blender Lab MCP is pinned to `4309a39646e644261624bfcd2bca669b343b7621` (package/add-on 1.0.0). Its unconstrained MCP dependency currently resolves to incompatible SDK 2.x. The setup pins **mcp 1.29.1**; changing that pin requires checking the official server's FastMCP imports. A Python virtual environment lives at `.tools/mcp-venv`; uv is not required.

Start the loopback bridge:

```powershell
./scripts/blender/start-bridge.ps1
# Interactive session instead:
./scripts/blender/start-bridge.ps1 -Gui -BlendFile assets/venues/hard-open-arena/hard-open-arena.blend
```

Only one bridge should listen on `127.0.0.1:9876`. Blender's `--online-mode` is necessary for even this loopback add-on socket; it applies to that process. The MCP client uses stdio, never HTTP. These are project-local tools and a separate profile, **not an OS sandbox**: the official add-on executes Python with this user's privileges. Run only reviewed project scripts.

The host's Codex MCP configuration has a namespaced `tenmulate-blender` entry pointing to `.tools/mcp-venv/Scripts/blender-mcp.exe`, with `BLENDER_PATH` pointing to the portable executable and loopback host/port environment variables. Codex may need a new task/session before the new tool inventory appears. The included client can use the actual MCP immediately:

```powershell
.tools/mcp-venv/Scripts/python.exe scripts/blender/mcp_client.py get_blendfile_summary_datablocks
.tools/mcp-venv/Scripts/python.exe scripts/blender/mcp_client.py execute_blender_code --script scripts/blender/build_hard_open_arena.py
```

Stop the bridge terminal with Ctrl+C. Installation and the stdio -> add-on -> Blender scene round trip were verified on 2026-09-05. No global Python or Store Blender installation was changed.

## Rebuild and review

`assets/venues/hard-open-arena/design.json` controls proportions, seating, roof aperture and display colors. Construction code is in `scripts/blender/build_hard_open_arena.py`. The generated `.blend` is an editable master with linked seat meshes, named architectural collections, packed textures, anchors and three review cameras. Rebuilding replaces this generated master, so save hand-edited variants separately or bring changes back into the source script first.

```powershell
npm run asset:venue:build
npm run dev
```

Open `http://127.0.0.1:4173/venue-review.html` for player/corner/bowl/roof views. The bowl view is an explicit roof cutaway matching the reference viewer's roof-removed overview. The review uses `TennisScene` itself, with a longer inspection fog range. Open `http://127.0.0.1:4173/?venueAsset=blender` for the normal practice UI. The normal default stays procedural until visual/performance acceptance; `VITE_AUTHORED_ARENA=1` enables the authored venue by default.

The build fetches and verifies the CC0 Poly Haven concrete maps listed in `sources.json`, builds/exports in Blender, validates glTF and registration anchors, instances repeated seats, compresses textures and geometry, and publishes a content-hashed GLB plus manifest. The source archive and normal/roughness maps are packed into the `.blend`. The runtime uses Meshopt and WebP (not KTX2); the current small texture set does not justify a separate KTX decoder. Decoded texture memory still needs profiling for future larger asset sets.

Cycles bakes neutral ambient occlusion into the terraces and the four shared seat meshes. The exported vertex colors add local depth while keeping time-of-day lighting dynamic. The representative seat bake is shared across each color variant; it is not a unique lightmap for every seat. The roof is modelled in a fixed open state; its assemblies are independently editable, but retraction animation is not implemented.

Large venue assets are excluded from service-worker precaching. A successfully visited hashed GLB is runtime-cached, with at most two versions and quota-error eviction. The manifest is network-first with an offline cached fallback. A first visit while offline uses the existing procedural venue. No download happens in the ordinary procedural path.

## Reference and asset provenance

- [IOMEDIA venue viewer](https://ausopen-rodlaverarena.io-media.com/web/index.html): supplied overview and live Section 18 / Row L interior view. `FullStadium.json` contains HTML image-map polygons, not stadium mesh vertices. No viewer image/model is redistributed.
- [COX redevelopment](https://www.coxarchitecture.com.au/project/rod-laver-arena-redevelopment/): seating/concourse and roof reference.
- [Robert Bird Group](https://www.robertbird.com/rbg-projects/rod-laver-arena/): structural context, including the 90 m rigging truss. This scene uses approximate visual proportions, not surveyed plans or an engineering replica.
- [Laykold US Open](https://www.laykold.com/us-open): blue/green court arrangement. `#24658d` / `#4c775a` are project sRGB approximations, not certified manufacturer RGB codes. Recoloring is not a claim of rights clearance.
- [Poly Haven brushed concrete](https://polyhaven.com/a/brushed_concrete), [CC0 license](https://polyhaven.com/license): only imported texture source. Geometry, acrylic textures and neutral signs are original.

No AO, US Open, sponsor or venue logos are embedded. The displayed name remains Hard Open Arena / Tenmulate.

## Verified pilot delivery — 2026-09-05

The editable master is 13,267,370 bytes with packed textures. The delivered GLB is `hard-open-arena.a72128d220f4.glb` (5,724,948 bytes / 5.46 MiB): 13,216 seats in four GPU-instanced batches, 83 meshes, 19 materials and 545,614 bytes of compressed texture payload. This is the model's constructed seat count, not a claim about Rod Laver Arena capacity.

- Official MCP stdio/add-on/Blender round trip, scene construction, AO bake and three Cycles renders succeeded. A separate clean Blender process also verified the pinned add-on enables without changing saved preferences.
- All 129 tests and the production build pass. Tests decode the actual shipped GLB and verify its hash, seat instances and independent gameplay anchors; lifecycle tests cover corruption, cancellation, late parsing and disposal.
- Khronos validation of the uncompressed export reports zero errors, zero warnings and 143 informational unused-data notices. The optimized Meshopt binary is separately decoded and checked; this is not a claim that the validator itself decodes Meshopt.
- Production browser review confirmed the final hashed asset; switching through the normal practice UI, alternate surfaces, forced network failure fallback and offline reload were exercised. Workbox precache contains no venue asset; runtime cache retains at most two visited GLB versions.
- Desktop 1600 × 1000 and narrow 390 × 844 layouts were inspected. Browser captures use the actual Three.js renderer, not substituted Cycles images. Local evidence and the explicit mismatch ledger are in `artifacts/venue-build/` and `docs/development/visual-verification.md`.

Remaining acceptance gates: browser lighting/material calibration against the references, close-up architectural refinement, target-device frame-time/memory/cold-load profiling, and owner visual approval. A desktop review sample was 148 draws / 1.81 million rendered triangles / 11 textures; the automation browser used Intel UHD via ANGLE, while Cycles used RTX OptiX. These observations do not establish a production performance pass. The existing large renderer-chunk warning remains in the build. The open roof is fixed, not animated; no audience or surrounding Melbourne precinct is modelled.
