# Blender clay arena

## Reference decisions — 2026-09-05

The requested second authored venue uses the modern **Court Philippe-Chatrier** as a visual reference, not the entire Roland-Garros complex. The existing `clay-sunset-arena` ID and shared runtime lighting remain authoritative. The new source is original geometry with Tenmulate-only branding; reference photography is not embedded.

The research separated three easily confused image families: the pre-2019 green-seated stadium, the rebuilt 2019 timber-seated bowl, and that bowl with its completed 2020 roof. The [SL Rasch page](https://www.sl-rasch.com/en/projects/roland-garros-center-court/) explicitly describes a **2016 concept**, so its frequently indexed renders were excluded. Olympic dressing and photos of Suzanne-Lenglen/Simonne-Mathieu were also excluded.

| Feature | Evidence | Authoring decision |
| --- | --- | --- |
| Court and scale | [Official venue page](https://stade.rolandgarros.com/lieux/court-philippe-chatrier): 10.97 × 23.77 m court within a published 21.85 × 43.87 m footprint; approximately 8,000 lower / 7,000 upper places | Regulation lines stay exact; a modestly wider apron accommodates original furniture and four clear approaches. Seat count is measured from the model, never claimed as actual venue capacity. |
| Bowl and palette | [DVVD's Laurent Kronental photograph](https://www.dvvd.fr/le-court-philippe-chatrier-prime/) shows the current enclosed stadium | Rectilinear stands, small chamfered corners, pale timber seats, light concrete, a continuous glazed hospitality band and green courtside walls. |
| Near-court and entry detail | [Faraone's 2019 project dossier](https://faraone-s3.s3.amazonaws.com/uploads/2019/06/Storyteller-05-Roland-Garros-e-Impianti-Sportivi.pdf), PDF pp. 5–10, 13: real views from baseline, upper corner and terrace; portal/glass-rail/stair details | Box-seating divisions, terrace-entry recesses, silver-framed glass barriers, separated player equipment. These photographs precede roof completion, but depict the rebuilt bowl. |
| Roof shape and motion concept | [FFT roof description](https://www.rolandgarros.com/fr-fr/article/toit-court-philippe-chatrier-mode-d-emploi) and the [public 2024 engineering teaching dossier](https://www.devenirenseignant.gouv.fr/media/12096/download), PDF pp. 6, 28 | Wings nest together at one end on two parallel runway beams, not two flat sliding leaves like the hard arena. Use ten original wing profiles, simplified bogies and a fixed-open state. Teaching diagrams are not an as-built structural certification. |
| Lighting | [FFT roof FAQ](https://www.rolandgarros.com/en-us/article/everything-you-need-to-know-about-the-roland-garros-roof-2020/) separates court lights from the roof | Fixture geometry and light anchors remain on the fixed structure; existing day/dusk/night runtime controls remain shared. |

Research stopped after the material gaps were covered by primary venue/architect/supplier evidence and public technical diagrams. No complete surveyed stadium plan was established; bowl dimensions, row/section counts, palette RGB values and facade composition are project approximations. The owner screenshots were discovery references, not evidence that every thumbnail depicts the built stadium.

Local-only research PDFs and inspected captures are under `C:/Users/20378/.codex/visualizations/2026/09/05/clay-arena/`. Source provenance is also recorded in `assets/venues/clay-sunset-arena/sources.json`. Original geometry and changed details do not, by themselves, constitute a legal clearance opinion.

## Rebuild and authored delivery

```powershell
npm run asset:venue:build -- -Venue clay-sunset-arena
# Re-optimize an existing raw export:
npm run asset:venue:optimize -- clay-sunset-arena
# Review the saved master with Cycles (presentation only):
.tools/blender-5.2.1-windows-x64/blender.exe --background assets/venues/clay-sunset-arena/clay-sunset-arena.blend --python scripts/blender/render_previews.py -- corner
```

The editable master is `assets/venues/clay-sunset-arena/clay-sunset-arena.blend` with packed textures, linked seats, architectural collections, three review cameras and gameplay/clearance/light anchors. Rebuilding replaces this generated master; retain hand-edited variants separately. `design.json` records authored proportions and `build_clay_open_arena.py` builds the complete venue, with import-safe mesh helpers in `venue_mesh.py`. The hard-arena builder and source are unchanged.

The first build used the actual official MCP bridge. The resumed session found port 9876 unavailable; the final build used the same installed Blender 5.2.1 LTS via the clean command-line path. It does not depend on a live MCP connection. No global installation or Blender user preferences changed.

Final model: **14,686 seats** (6,517 lower / 8,169 upper), ten independently editable parked roof wings, four player-access approaches and four fixed light anchors. The master is 21,734,095 bytes; the runtime asset is `clay-sunset-arena.3268b70b2ec2.glb`, **7,296,132 bytes / 6.96 MiB**, with 63 meshes, 17 materials and 590,590 bytes of compressed texture payload. Original clay albedo/roughness/normal and ash-grain maps are relightable; neutral Cycles vertex AO adds local contact depth without baking sunlight into the asset.

Khronos validation of the raw export reports zero errors and warnings (120 informational unused-data notices). The optimizer independently decodes the final Meshopt/WebP asset, checks six regulation registration anchors and enforces the 15 MiB budget. Browser comparison prompted reduced clay ripple contrast, completed tunnel floors/rear linings, clearance above ground entrances, radial canopy ribs and inward visibility of the opaque outer enclosure to prevent sky leaks through service recesses. The roof is a **fixed-open architectural model**, not an animated or structurally certified mechanism.

## Runtime and verification

Open `/venue-review.html?venue=clay-sunset-arena&camera=corner` on port 4173. The ordinary app remains procedural unless `?venueAsset=blender` or `VITE_AUTHORED_ARENA=1` is enabled; choose **Outdoor Arena · Clay** in practice. The review's practice link opens the standard setup, not a forced venue override of stored preferences. Hard/clay managers retain independent native materials and loading state, and both use the unchanged shared day/dusk/night lighting. Completed inactive assets remain resident until scene disposal; first selection transfers only the selected GLB (the constructor's initial hard-manifest request may be cancelled when clay is selected immediately).

- `npm test`: **142 tests / 15 files pass**. Actual shipped GLBs are decoded: hash/size, regulation anchors, seat instances, surface PBR maps, four ground approach volumes (including first-row terraces/stairs), ten north-parked wings and four fixed light anchors. Loader tests cover ID/path swaps, bounded manifests, corruption, cancellation, late parse disposal, independent managers and borrowed-material ownership.
- `npm run build`: TypeScript and production build pass; the existing large renderer chunk warning remains (663.30 kB uncompressed). No new runtime package was added.
- Production review on `http://127.0.0.1:4174`, Playwright/Chromium at **1600 × 1000** and **390 × 844**: correct title/nonblank canvas/no framework overlay; camera views, six venue states, hard/clay switching, day/dusk/night and mobile control layout pass. `scrollWidth = innerWidth = 390`. Actual screenshots were inspected, not inferred from test status.
- Normal practice: Open in practice → Outdoor Arena · Clay → Return → Golden hour produces the authored clay venue, clay surface, Serve and time 18.5 with no console errors/warnings during the interaction. Start practice reaches the existing physical-room safety confirmation; the agent did not attest that the user's room was cleared, so active rehearsal beyond that gate remains a manual check.
- Offline production reload succeeds for **both final authored assets** with the correct review HTML/query identity. The final clay hash `3268b70b2ec2` is in the runtime cache; neither venue is in the shell precache. A clean ordinary setup selecting clay performs **zero venue-asset requests**. A deliberately aborted clay GLB produces a visible error status while retaining the procedural court/venue. The test's network and service-worker-blocking diagnostics are expected.
- The final warm production loop logged zero errors/warnings. Cold Intel ANGLE compilation emitted the previously observed nonfatal X4122 precision warning; after a separate service-worker test, one navigation also reported unused/cross-world preload notices. These did not recur in the final loop and did not prevent rendering. They remain browser portability observations, not suppressed errors.

Representative single-clay view: **136 draws / 2,071,098 rendered triangles / 15 textures**. After visiting both authored venues, retained textures reach 21. Background automation FPS is not a performance acceptance result. Remaining gates are target-device frame-time/memory/cold-load profiling and owner art approval; micro-weathering, crowd/context, surveyed fidelity and roof animation are not delivered in this pass. The final Cycles corner view is `artifacts/venue-build/clay-sunset-arena/blender-corner.png`; it is source inspection, not runtime evidence. See the [Stage 12 mismatch ledger](visual-verification.md#stage-12-blender-clay-open-arena--2026-09-05).
