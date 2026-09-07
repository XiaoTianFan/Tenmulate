# Neutral opponent asset record

> Historical carrier and skeleton-source record. The displayed player is now the [articulated mannequin](quaternius-articulated-mannequin.md); current animation delivery is defined in the [motion contract](../development/local-motion-pipeline.md).

- **Runtime ID:** `quaternius-neutral-male-v1`
- **Status:** Accepted as the V1 mocap carrier; tennis animation and racket still pending
- **Retrieved and normalized:** 2026-08-30
- **Runtime file:** `public/assets/opponents/quaternius-neutral-male.glb`

## Source and rights

The selected source is Quaternius's **Universal Base Characters Kit**, Standard FREE package, specifically `Superhero_Male_FullBody.gltf`. The creator publishes the pack under the CC0 1.0 Public Domain Dedication and describes the characters as game-ready, approximately 13k triangles, and rigged for humanoid retargeting.

- Official pack page: https://quaternius.com/packs/universalbasecharacters.html
- Distribution page: https://quaternius.itch.io/universal-base-characters
- Source archive: `Universal Base Characters[Standard].zip`, 128,968,391 bytes
- Source archive SHA-256: `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40`
- Runtime GLB SHA-256: `7cea6c92d2f78b07096948f0270bb4db7340505d27da6ffa52e292da858b33c4`
- Runtime GLB size: 741,412 bytes

The full source archive is deliberately not committed. The runtime asset ships beside a copied license/provenance notice and a machine-readable asset manifest.

## Normalization performed

`scripts/build-neutral-opponent.mjs` validates the required skeleton names, strips all texture references, replaces the three source materials with one matte neutral material, removes the separate `Eyes` and `Eyebrows` nodes from the active scene graph, renames the body node, embeds the geometry buffer, and writes a self-contained GLB. No local generative model is used.

The source body sculpt still contains simplified facial volume. It is treated as a faceless presentation because eye/eyebrow assets and textures are absent and the opponent is rendered in one matte color at the far baseline. It is not approved for a face close-up. The free package also uses the creator's athletic “superhero” proportions rather than the paid package's regular-proportion model; this is acceptable for the distant V1 motion carrier but remains a replaceable asset behind the same adapter.

## Rig contract

- One 65-joint skinned humanoid, including fingers.
- A 23-role canonical adapter covers root, pelvis, spine, head, shoulders, arms, hands, legs, feet, and toes.
- `hand_l` and `hand_r` are the stable detachable-racket attachment bones.
- This original source carrier has no animation. The default display loads the derived `tennis-local-v1` bundle with twelve clips, including both slices and a running cycle, and an original locally authored racket. It is baked to this exact rig in the sibling motion lab.
- The static carrier retains procedural ready-stance support; gameplay now uses absolute-time skeletal sampling, root travel and leg IK. See the [motion ledger](../development/local-motion-pipeline.md) for hashes and evidence.
- If the GLB or skeleton validation fails, the existing ball machine remains visible and the application continues to function.

## Open acceptance gates

Local implementation covers the three source-informed strokes, connectors, separate racket node, provenance hashes, contact/toss/recovery metadata, mirrored handedness and contact-clock integration. Exported-skin tests and desktop browser review pass. The corrections are partly authored, not exact automatic Djokovic reconstruction.

Remaining acceptance: owner technique/close-up grip review; distinct secondary shot styles; named-device loading, frame-time, memory, cross-browser and long-session checks. Public deployment remains separate.
