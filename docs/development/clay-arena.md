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

Final model: **14,686 seats** (6,517 lower / 8,169 upper), ten independently editable parked roof wings, four player-access approaches and four fixed light anchors. The master is 21,733,632 bytes; the runtime asset is `clay-sunset-arena.3ac874468ae8.glb`, **7,296,072 bytes / 6.96 MiB**, with 63 meshes, 17 materials and 590,590 bytes of compressed texture payload. Original clay albedo/roughness/normal and ash-grain maps are relightable; neutral Cycles vertex AO adds local contact depth without baking sunlight into the asset.

Khronos validation of the raw export reports zero errors and warnings (121 informational unused-data notices). The optimizer independently decodes the final Meshopt/WebP asset, checks six regulation registration anchors and enforces the 15 MiB budget. Browser comparison prompted reduced clay ripple contrast, completed tunnel floors/rear linings, clearance above ground entrances and radial canopy ribs. The roof is a **fixed-open architectural model**, not an animated or structurally certified mechanism.
