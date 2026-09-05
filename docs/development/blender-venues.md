# Blender-authored venues

The hard-open arena is an original Rod Laver-inspired architectural study with a blue playing area and green surrounds. It is available for review before replacing the default procedural venue. Exact gameplay court dimensions remain in `src/domain/court.ts`; Blender owns the visible court, net, furniture, bowl and roof. Runtime lighting, atmosphere, opponent and trajectories remain in Three.js.

## Second authored venue: clay arena

The reference-led clay arena is also built and integrated. Its Philippe-Chatrier research, source decisions, revision-4 **13,664-seat** court-aligned master, **7.00 MiB** optimized GLB and verification are in [Clay arena](clay-arena.md). Its translucent, trussed roof remains fixed **half-open**; denser rough-transmission fabric now casts continuous readable court shade, with a bounded runtime diffuse-light allowance. The existing browser transmission pass remains. Run `npm run asset:venue:build -- -Venue clay-sunset-arena`; the omitted argument still rebuilds hard. Review `/venue-review.html?venue=clay-sunset-arena&camera=sideline` for seating and roof detail. The existing opt-in flag enables either selected arena, with per-venue loading/native materials and the same shared atmosphere. The hard source and hashed asset are unchanged. [ADR-0010](../decisions/0010-blender-clay-arena-and-multi-venue-boundary.md) extends the pilot boundary without making either asset the default.

## Third authored venue: grass arena

The neutral **Grass Open Arena** is built and integrated under `grass-center-court`. It has **14,381** linked green seats, three rake zones, curved corner stands, a striped **22 × 41 m** lawn, baseline garden pavilion, recessed entrances, dark fixed canopy and two open concertina roof banks. The packed Blender master is **18,764,966 bytes**; the current GLB is **6.06 MiB**. [Grass arena](grass-arena.md) records the official seating-plan/photo/artist-reference comparison, estimated dimensions and verification. Build with `npm run asset:venue:build -- -Venue grass-center-court` and inspect `/venue-review.html?venue=grass-center-court&camera=corner`. [ADR-0011](../decisions/0011-blender-grass-arena.md) extends the same per-venue loading/registration/cache boundary; hard and clay sources remain unchanged, and the procedural default/fallback remains.

## Revision 2: perimeter and roof detail

The owner's annotated reference supersedes the pilot's freestanding tunnel frames. A 2.35 m padded retaining wall now follows the raised front tier; four 2.8 m wide / 2.18 m high entrances break that wall and recess underneath the seats. Separate 0.42 m courtside boards sit inward of the wall with aligned access breaks. Benches, coolers and umpire seating share the central player-service side, away from the door approaches. All wall/board branding is Tenmulate. The apron extends beneath the perimeter instead of leaving a bright unfilled strip.

The roof's real opening now uses its declared 33 × 37 m aperture, rather than an unrelated bowl offset. Parked leaves clear it by 0.35 m and rest on modelled carriages, wheel bogies, transverse paired trusses and twin rails; catwalks and guards provide a service route. This is an original visual mechanical interpretation, not an engineering reconstruction or an animated roof simulation.

The regenerated master has 13,304 seats. The revision's runtime asset is `hard-open-arena.8a6bb53797c2.glb` (5,750,320 bytes, 5.48 MiB). Four seat batches plus two repeated-sign batches total 13,326 instances. Tests decode the shipped binary, check both board heights, assert clear three-dimensional doorway approach volumes against the actual perimeter/furniture triangles, and check parked-leaf clearance. The 2026-09-05 pilot statistics below are retained as historical evidence, not current asset counts.

## Shared browser lighting — revision 2

`src/engine/rendering/venueLighting.ts` is the single source for solar elevation, direct-light strength, hemispheric fill, environment intensity, exposure and fixture fade. Both authored and procedural venues use it through `DynamicSkySystem` and `TennisScene`; there is no Blender-only exposure trick. This is an art-directed time schedule, not a date/latitude solar ephemeris. New environments start at a 145° light direction; saved directions are preserved.

Daylight uses a high directional key with restrained sky/environment fill so roof and bowl shadows remain visible. Evening retains oblique warm sunlight, a warm cloud/sky grade applied to both visible Sky and its PMREM capture, and a gradual overlap with court floodlights. Night retains the existing full fixture power, night fill and exposure. Indoor halls exclude the sky/sun and retain their local lights with a slightly reduced fill. The PMREM capture is debounced by 120 ms; visual checks must allow it to settle after changing time/weather.

One directional shadow camera covers the venue rather than only the court: ±60 m bounds, 1–300 m depth, 4096-pixel maps in Quality and 2048 in Auto/Performance, clamped to the GPU limit. Thin authored roof sheets cast on both sides without changing visible culling. Instanced seats receive shadows and retain nondirectional baked AO, but do not each cast into the map. This follows the [Three.js shadow-camera tradeoff](https://threejs.org/manual/en/shadows.html) and [material shadow-side control](https://threejs.org/docs/pages/Material.html). It is a raster PBR/shadow-map implementation, not real-time path tracing or a claim of Cycles-quality global illumination.

Revision verification: all 135 tests and the production build pass. The actual rebuilt GLB passes hash, decode, anchor, doorway-clearance and roof-clearance checks; raw glTF validation reports zero errors/warnings and 194 informational unused-data notices. Final production review covered all six venue identities, authored/procedural switching, outdoor day/dusk, indoor lighting, night, a 390 × 844 layout, offline cached-asset reload and Return → Golden hour in normal practice. The review-query service-worker regression found during this pass is fixed: client-side `camera`, `version` and `venue` parameters resolve to the review HTML, not the main-app fallback. Warm production/interaction checks logged zero console errors or warnings. A fresh Intel ANGLE session emitted one nonfatal shader precision warning (X4122) while compiling the environment pass; no visible rendering failure occurred. Practice wheel zoom's separate passive-listener errors were reproduced and fixed; FOV now changes 70° → 74° → 70° without errors.

The current representative player view is 156 draws / 1.84 million rendered triangles / 11 textures. These are observations, not a frame-time acceptance test. Reference images and actual browser captures were compared directly, with remaining mismatches recorded in [visual verification](visual-verification.md#stage-11-arena-access-roof-detail-and-shared-lighting--2026-09-05). New screenshots/logs are local-only under `C:/Users/20378/.codex/visualizations/2026/09/05/arena-refinement/`; source `.blend`, generation code and the shipped GLB remain in the repository. Target-device profiling, roof animation, architectural microdetail and final owner visual approval remain open.

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

Open `http://127.0.0.1:4173/venue-review.html` for player/corner/sideline/bowl/roof views; `?camera=sideline` starts at the annotated reference's comparison angle. Time, quality, authored/procedural and all-six-venue controls share the actual renderer. The bowl view is an explicit roof cutaway matching the reference viewer's roof-removed overview. The review uses `TennisScene` itself, with a longer inspection fog range. Open `http://127.0.0.1:4173/?venueAsset=blender` for the normal practice UI. The normal default stays procedural until visual/performance acceptance; `VITE_AUTHORED_ARENA=1` enables the authored venue by default.

The build fetches and verifies the CC0 Poly Haven concrete maps listed in `sources.json`, builds/exports in Blender, validates glTF and registration anchors, instances repeated seats, compresses textures and geometry, and publishes a content-hashed GLB plus manifest. The source archive and normal/roughness maps are packed into the `.blend`. The runtime uses Meshopt and WebP (not KTX2); the current small texture set does not justify a separate KTX decoder. Decoded texture memory still needs profiling for future larger asset sets.

Cycles bakes neutral ambient occlusion into the terraces and the four shared seat meshes. The exported vertex colors add local depth while keeping time-of-day lighting dynamic. The representative seat bake is shared across each color variant; it is not a unique lightmap for every seat. The roof is modelled in a fixed open state; its assemblies are independently editable, but retraction animation is not implemented.

Large venue assets are excluded from service-worker precaching. Successfully visited hashed GLBs are runtime-cached, with at most four URLs across both venues and quota-error eviction. Manifests are network-first with offline cached fallback. A first visit while offline uses the existing procedural venue. No arena download happens in the ordinary procedural path. Older single-venue verification records below retain their historical two-entry limit.

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
