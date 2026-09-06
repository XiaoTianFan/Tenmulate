# Lean neutral player

Replacement in progress for the muscular Quaternius body. Target standing height is 1.88 m; the MakeHuman Community base mesh and its adult male morphs, rig landmarks, and skin weights are CC0 assets. Source revision: `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`.

- Source: https://github.com/makehumancommunity/makehuman
- Asset/output licensing: https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.md
- Keep the 65-bone tennis skeleton and its rest matrices, finger controls, and hand sockets. Fit and bind the new body to this skeleton.
- Preserve all 23 clips, their decoded animation tracks, phase/contact/toss clocks, and recovery/locomotion metadata. The character's display scale and world contact calibration may change to reflect 1.88 m stature.
- Verify skin deformation in strokes, both handedness modes, and locomotion; retain numerical export, anatomical, choreography, and gameplay checks.
- Source model data and reproducible authoring scripts are independent of application code licensing. No third-party skin, clothing, or textures are used.

The previous carrier remains a build-time skeleton source with its CC0 provenance. It is not the new player's body geometry.
