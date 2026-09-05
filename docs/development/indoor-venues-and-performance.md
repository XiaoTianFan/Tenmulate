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
- Empty (default), Half seated and Fully seated settings persist with practice
  preferences and carry into rehearsal. Half is an exact deterministic subset of
  Full. Audience placement comes from every original Blender seat, including the
  grass baseline pavilion, and is identical between quality levels.
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
