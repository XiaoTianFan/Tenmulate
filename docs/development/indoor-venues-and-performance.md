# Six Blender venues and performance variants

## Authoring and ownership

All six built-in venues now have packed Blender masters and a dedicated low-detail
GLB. The three indoor halls are original designs, retaining the timber / clay
training hall / barrel-vault grass identities. They are not reconstructions of
named real buildings. Structure, complete end walls, entrances, spectator aisles,
seating, PBR court textures, lines, nets, benches and umpire equipment live in
Blender. Physics/raycast coordinates, sky/weather and runtime lighting stay in TS.

Indoor designs use 36 x 52 m, 40 x 56 m and 38 x 54 m hall footprints respectively.
Side bleachers have five/eight/six rows, 0.82 m pitch and 0.34 m rise, with 1.4 m
straight circulation aisles. These are visual design dimensions, not certified
building/accessibility plans. Original albedo, roughness and normal maps are
baked to PNG; Cycles bakes neutral local seat/concourse AO. Linked seat shells
become GPU instances during glTF optimization. Indoor fill uses one cached PMREM
room-light environment plus four light anchors aligned with visible fixtures.

## Rebuild

```powershell
npm run asset:venue:build -- -Venue timber-hall
npm run asset:venue:build -- -Venue clay-stadium
npm run asset:venue:build -- -Venue covered-grass-arena
# Re-export a low-detail outdoor variant from its existing packed master:
npm run asset:venue:build -- -Venue grass-center-court -VariantsOnly
node scripts/blender/prepare_audience.mjs
```

All six IDs are supported by `scripts/blender/build.ps1`. `-VariantsOnly` requires
the existing raw Quality GLB and build statistics in the ignored artifacts tree;
a normal full build produces these first. Blender 5.2.1 portable is pinned locally.
The performance exporter reads but does not save over the detailed master.

Performance replaces seat shells with four-triangle folded seats, omits secondary
rails/slats/hardware, uses a 64-triangle alpha-cutout net, disables roof material
transmission, and reduces texture maps to 256 px. It retains all seat anchors,
court dimensions, roof aperture and the building silhouette. Publication fails
unless geometry falls below 40% and bytes below 65% of Quality; hard caps are
15 MiB Quality and 4 MiB Performance. Actual delivered reductions exceed these.

## Runtime and audience

- All venues load through `VenueAssetManager`; no procedural venue presentation
  or duplicate court/net is constructed. A missing/corrupt asset shows a retryable
  error. Switching venue releases old CPU/GPU resources; variants do not coexist.
- Performance selects its manifest entry before downloading. Auto starts light
  on small screens and steps down after three sustained slow metric windows;
  explicit Quality always selects the detailed asset. Auto does not oscillate.
- Manifest, hash, byte count and court anchors are checked before reveal. A stale
  decode cannot reattach after cancellation. Large assets are runtime-cached only,
  excluded from the app shell precache. Cache bounds: twelve GLBs, six manifests,
  ten audience resources; no all-venue prefetch.
- Half seated (default for all six courts as of 2026-09-08), Empty and Fully seated settings persist with practice
  preferences and carry into rehearsal. Half is an exact deterministic subset of
  Full. Audience placement comes from every original Blender seat, including the
  grass baseline pavilion, and is identical between quality levels. Missing or
  invalid occupancy uses Half seated; an explicitly saved Empty/Full choice remains valid.
- A shared front/back 16-person atlas pair is sampled by spatially chunked
  `InstancedMesh` cards: two triangles per person, no skeletons or per-seat frame
  work, depth writes and chroma-key discard instead of transparent blending.
  Full indoor crowds use four visible batches; outdoor court views use roughly
  twenty. Empty unloads and does not fetch either registration or artwork.
- Quality uses 1024 px atlases and subtle shader sway; Performance uses 512 px
  atlases and static poses. Reduced-motion preference also stops motion. Artwork
  provenance and prompts are in `assets/audience/README.md`.

Implementation references: [Three.js instancing](https://threejs.org/docs/pages/InstancedMesh.html),
[room environment](https://threejs.org/docs/pages/RoomEnvironment.html). Runtime
details were checked against the installed r185 source, not a different renderer.

## Verification boundary

Final model budgets (decimal MB; model triangles include all GPU seat instances,
not renderer shadow/transmission passes or the runtime opponent/audience):

| Venue | Quality → Performance MB | Quality → Performance triangles | Seats |
| --- | --- | --- | --- |
| Timber hall | 1.018 → 0.183 | 80,606 → 10,114 | 560 |
| Clay hall | 1.116 → 0.174 | 113,894 → 14,698 | 896 |
| Grass hall | 1.096 → 0.236 | 96,726 → 17,058 | 672 |
| Hard arena | 5.835 → 2.698 | 1,453,296 → 227,160 | 13,304 |
| Clay arena | 7.423 → 2.649 | 1,474,248 → 275,504 | 13,664 |
| Grass arena | 6.393 → 1.138 | 1,430,222 → 159,650 | 14,381 |

All twelve raw exports validate with zero glTF errors and warnings. A timber
beam-cap tangent warning was corrected by triangulating only n-gon caps before
export; UVs and geometric triangle counts are unchanged. Build-time Blender HIP
probe/deprecation notices are distinct from asset validation; CPU AO completes.
The final suite passes 179 tests in 21 files; the production build passes with
the existing renderer chunk-size warning (about 637 kB minified).

`tests/six-venue-variants.test.ts` decodes both shipped GLBs for every venue and
checks hashes, dimensions, actual instanced triangle reductions, low-detail net
cutout, seat counts, and stable occupancy. Existing outdoor architecture and net
tests still protect detailed geometry. Browser evidence and machine-specific
frame readings are recorded in the visual-verification log after final QA.

These are 2D crowd impostors, deliberately unsuitable for very close side-on
inspection; no volumetric crowd or skeletal animation is claimed. Detailed
outdoor venues remain GPU-heavy. Browser frame readings are not universal device
performance guarantees or owner visual approval.

## Local review recovery (2026-09-05)

The reported blank indoor reviews were reproduced on the existing Codex in-app
browser at port 4173. All three indoor `manifest.json` requests returned HTTP 200
with `text/html` and the Vite app shell, although the corresponding files existed
in `public/assets/venues`. The outdoor manifests were JSON. Production preview
on 4174 served all six correctly. Restarting **only the Tenmulate Vite dev
server** restored all indoor JSON responses without regenerating any model.
This is consistent with a stale Vite public-file index after new asset folders
were added; the precise missed filesystem-watcher event was not established.

After adding/exporting venue folders, verify the actual review server, not only
the filesystem or a separate production preview:

```powershell
$response = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4173/assets/venues/timber-hall/manifest.json
$response.Headers['Content-Type'] # application/json, never text/html
($response.Content | ConvertFrom-Json).id # timber-hall
```

If the dev server returns HTML for an existing manifest, restart that exact
project's server (`npm run dev -- --strictPort`) and reload the review. For a
deployed build, check that the complete public asset folders were shipped and
that missing asset URLs are not rewritten to the app shell. Do not substitute
procedural geometry or clear unrelated browser/site data. The loader now
explains this condition, identifies the requested venue and retains Retry;
regression tests exercise HTML rejection and successful retry for each indoor
venue, including an HTML body without its content-type header.

Review selectors now update `venue`, `audience`, `quality`, and `camera` query
parameters. Refreshing or copying the URL preserves these selected presets
instead of silently restoring the initial venue. Free-look offsets and time of
day remain session-local; this change does not add persistence for them.

Use the Venue dropdown, or open these direct local links:

- [Timber hall](http://127.0.0.1:4173/venue-review.html?venue=timber-hall&audience=half&camera=player)
- [Clay hall](http://127.0.0.1:4173/venue-review.html?venue=clay-stadium&audience=half&camera=player)
- [Grass hall](http://127.0.0.1:4173/venue-review.html?venue=covered-grass-arena&audience=half&camera=player)

All three outdoor arenas already implement the Audience selector in review and
practice setup. The Codex in-app browser was used at 1280 x 720 to exercise each
of the nine Quality-mode states below; visible screenshots show occupied seats
and cleared crowds, not just successful asset requests:

| Outdoor venue | Empty seats | Half seated | Fully seated |
| --- | ---: | ---: | ---: |
| Hard arena | 0 | 6,652 | 13,304 |
| Clay arena | 0 | 6,832 | 13,664 |
| Grass arena | 0 | 7,190 | 14,381 |

All three indoor Quality scenes also rendered in that browser, with half crowds
of 280 / 448 / 336 respectively. A grass-arena Performance/sideline/half-seated
selection retained the venue, quality, camera and 7,190 spectators after reload.
Page identities, meaningful rendered architecture, selectors and absence of a
framework overlay were checked. No app errors appeared in the recovered tab;
existing Three.js PMREM blur sample-clipping warnings remain, unrelated to the
manifest failure. No mobile-size pass or device-performance claim is included.

Verification: 33 focused venue/audience tests passed, then all 200 tests in 21
files passed with the completed motion iteration present. Production build
passed with the existing approximately 637 kB renderer chunk warning. No GLB,
seat registrations, audience artwork or motion files changed in this fix.
