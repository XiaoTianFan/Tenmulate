# ADR-0010: Second Blender arena and per-venue loading boundary

- Status: Accepted for requested local implementation and opt-in review; owner visual/device acceptance pending
- Date: 2026-09-05
- Extends: ADR-0009 to the existing `clay-sunset-arena` identity; no catalogue expansion

The owner requested a second Blender venue based on Roland-Garros. The built post-2019 Philippe-Chatrier bowl and completed 2020 roof are the reference, supported by primary architect/supplier photographs and a public roof-mechanism teaching dossier. Older stadium imagery, other courts and the unbuilt SL Rasch concept are excluded. Geometry, textures and Tenmulate branding are original; altered proportions and ten rather than eleven wings distinguish the study without implying legal clearance. See the [source decisions](../development/clay-arena.md).

Blender owns the visible clay court/net, pale ash seating, limestone terraces, glass hospitality band, green padded walls, recessed entrances, equipment, facade and fixed-open roof. Regulation coordinates, physics, opponent, camera and atmosphere remain under the existing TypeScript authority. No roof animation, crowd, precinct model or structural certification is included.

`AUTHORED_VENUES` permits exactly hard and clay. Each `VenueAssetManager` owns its asset, native-surface materials, load state, cancellation and disposal. A manifest must match the requested ID and its own folder/filename; cross-venue or corrupted results fail closed to the procedural court/venue. Native clay preserves exported PBR maps; alternate surfaces borrow the existing runtime material bundle. Independently placed light anchors drive the four fixtures without importing Blender presentation lights.

The existing opt-in switch enables both replacements. Inactive completed scenes remain cached in memory for fast switching and are disposed with `TennisScene`; concurrent residency therefore needs device profiling. Each GLB stays below the 15 MiB transfer cap. Neither venue is shell-precached; the shared runtime cache holds at most four visited hash URLs (an aggregate limit, not four per venue), with network-first manifests and cached offline fallback. An uncached/failed authored load retains procedural presentation.

The review uses actual `TennisScene`, updates venue identity and supports camera/time/quality/version controls. A Cycles render is source inspection, never substituted for browser evidence. Both the default replacement gate and target-device performance/owner visual acceptance remain open; successful local tests/build are not deployment or final art approval.
