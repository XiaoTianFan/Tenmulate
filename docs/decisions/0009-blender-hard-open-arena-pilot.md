# ADR-0009: Blender-authored hard-open arena pilot

- Status: Accepted for opt-in implementation and review; default replacement pending visual/performance acceptance
- Date: 2026-09-05
- Extends: ADR-0005 and ADR-0007 for one venue

The owner requested a more substantial authored arena, using Rod Laver's architectural form as reference and a blue/green hard-court palette. The procedural venue remains useful as a transition and offline/loading fallback.

The owner subsequently approved this as the direction for future court authoring and requested a refinement pass. Revision 2 replaces freestanding entrance blocks with recessed breaks in a raised perimeter wall, separates low courtside boards, adds roof carriage/rail detail, and upgrades shared day/dusk lighting for every venue. This directional approval does not replace the explicit final visual/performance gate or enable the asset by default.

For `hard-open-arena`, a versioned Blender Python builder and editable packed `.blend` now own the visible court, net, seats, concourses, tunnel linings, facade, open roof assemblies, signs and furniture. The source is parameterized rather than extracted from a third-party viewer. The viewer's `FullStadium.json` is image-map metadata; no proprietary model or imagery is shipped. CC0 concrete maps and original materials have recorded provenance.

TypeScript retains regulation coordinates, raycasting, physics, ball, opponent, trajectories, camera semantics and surface selection. The GLB must pass named court-anchor validation against those gameplay constants. Three.js retains dynamic lighting, sky, weather and wetness. Baked ambient occlusion is nondirectional and does not encode sunlight or time of day.

`VenueAssetManager` is the opt-in boundary: manifest validation, byte/hash verification, async loading, Meshopt decoding, scene registration, atomic presentation replacement, cancellation and disposal. A failed load keeps the procedural presentation. Alternate surfaces use the existing court material bundle. The review's roof cutaway changes object visibility only.

Assets use immutable hash filenames and runtime caching, excluded from the service-worker shell precache. This asset uses Meshopt plus WebP; KTX2 remains an option when texture residency becomes the limiting budget. Blender and MCP are development tools, never runtime services.

The feature is enabled by `?venueAsset=blender` or `VITE_AUTHORED_ARENA=1`. `/venue-review.html` provides an explicit review surface. This decision does not approve the replacement as the default, the other five venues, an exact architectural reconstruction, animated roof mechanics, or a target-device performance budget. See [build and verification notes](../development/blender-venues.md) and the [visual ledger](../development/visual-verification.md).
