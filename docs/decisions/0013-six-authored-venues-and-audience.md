# Six authored venues, quality variants and seated spectators

Status: implemented and locally verified, 2026-09-05. Owner visual acceptance and public deployment remain separate gates.

The owner has authorized replacing the three indoor procedural halls and retiring the six procedural venue presentations. Three.js remains the renderer, sky/weather/light controller and gameplay integration layer; Blender owns the visible court, architecture, seating and equipment. This extends the earlier three-venue opt-in pilot.

## Delivery stages

1. Build original timber, clay and grass indoor halls in reproducible Blender scripts, with packed masters, material maps, registration anchors, linked seats and light anchors.
2. Export a separate performance GLB for each of the six venues. Preserve court registration, roof silhouette, entrances and seat anchors while simplifying seat meshes, secondary structure and textures. Measure geometry and payload reductions.
3. Switch the runtime to lazy authored-only loading, select the asset before downloading, bound resident resources and expose recoverable load errors instead of silently showing a different venue.
4. Add a shared alpha-tested spectator atlas on instanced seat-oriented cards, stable seeded empty/half/full occupancy, modest optional motion and no per-person scene objects. Empty occupancy does not fetch the atlas.
5. Verify all six models, variant switching, audience placement, cancellation/disposal, desktop/mobile rendering and production build before integration.

## Constraints

- Physics dimensions and camera/raycast authority remain in TypeScript. All exports pass the existing court-anchor contract.
- No external trademarks, models or event photography are shipped. Audience artwork is generated, with its prompt and provenance retained.
- Performance is a real lower-detail asset, not only lower pixel ratio. Geometry and texture budgets are checked at publication.
- The detailed outdoor architecture is preserved. Existing roof opacity and denser-net refinements are not reverted.
- Occupancy defaults to empty for backward-compatible startup cost; half is a deterministic subset of full.
- Screenshots, QA scripts and transient logs remain outside the repository. Source, generated product assets and development documentation are committed in stages.
