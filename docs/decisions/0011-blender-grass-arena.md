# ADR-0011: Third authored venue - neutral garden grass arena

- Status: Accepted for requested local implementation and opt-in review; visual/device approval pending
- Date: 2026-09-05
- Extends: ADR-0009 and ADR-0010 to the existing `grass-center-court` catalogue ID

The owner requested a Blender grass arena informed by modern Centre Court architecture, without explicitly identifying the real venue in the product. The official schematic seating plan, published lawn/roof facts, owner photographs and the owner-supplied Leon Labyk ArtStation study inform original geometry. Public sources do not provide complete as-built row sections; estimated dimensions and intentional differences are recorded in [Grass arena](../development/grass-arena.md) and source provenance. No third-party model or reference photograph is imported or redistributed.

Blender owns the striped lawn and court/net, three rake zones with linked green seats, rounded corner stands, dark parapets, recessed access, original baseline pavilion, equipment, facade, fixed canopy and two parked concertina banks. Roof pose is statically open. Crowds, playable roof animation, structural certification and the surrounding real-world precinct are not part of this asset.

`AUTHORED_VENUES` now permits hard, clay and grass. The existing opt-in gate, per-venue manager, manifest ID/hash/size validation, regulation anchors, native-surface materials, cancellation and disposal remain authoritative. The same roof-shadow treatment applies to the dense folded fabric; fixed canopy remains opaque. Runtime TypeScript retains physics, target/raycast authority, opponent and shared sky/weather/exposure/lighting.

The existing asset pipeline accepts the third ID. Its GLB is limited to 15 MiB, is excluded from shell precaching and enters the bounded runtime cache only when visited. Network-first manifest/cache behavior and procedural fallback remain; the aggregate cache limit remains four GLB hashes, not four per venue. In-memory residency of three loaded arenas requires target-device profiling. No hard/clay source rebuild or default replacement is authorized by this extension.

Verification includes actual decoded geometry/material/UV/seat/roof/access checks and production browser comparisons at player, corner, sideline, bowl, roof, day/dusk/night and desktop/mobile. Offline visited-asset reload, missing-asset fallback and zero-download default path must be distinguished from visual proof. Local implementation is not deployment, legal clearance or owner visual approval.
