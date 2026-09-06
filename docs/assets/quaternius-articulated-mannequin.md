# Articulated tennis mannequin

The neutral player uses Quaternius's CC0 Universal Animation Library Standard mannequin, release 3.0 (16 June 2026). It has a faceless head, separate smooth limb shells and dark joint sections. Display standing height is 1.88 m. This replaces the rejected semi-realistic body in Motion Lab and gameplay.

- Creator: https://quaternius.com/packs/universalanimationlibrary.html
- Download: https://quaternius.itch.io/universal-animation-library
- License: `public/assets/opponents/LICENSE.quaternius-mannequin.txt` (CC0-1.0).
- Source archive/model hashes and download endpoint: `scripts/characters/source.json`.
- Generated carrier: `public/assets/opponents/quaternius-mannequin.glb`; its manifest records source, builder and skeleton hashes.

Run `powershell -NoProfile -File scripts/characters/fetch_player.ps1`, then Blender with `--background --factory-startup --python-exit-code 1 --python scripts/characters/build_player.py`. Source downloads and the editable `.blend` stay in ignored `artifacts/character-source/`.

The builder transfers the mannequin's mesh rest coordinates and normalized skin weights onto the existing 65-bone tennis armature. Head and torso volume are retained; limb lengths follow the calibrated joints. It does not import the source library's 43 animations. Both source rigs use the same bone names, including the fingers. Neutral panels and dark joints use vertex colors in one skinned primitive.

The original Quaternius carrier remains only as a reproducible skeleton source. The lab imports that exact armature, binds the new mesh and bakes our 23 clips. `check_character_preservation.mjs` compares every decoded track, timestamp and clip metadata field against the revision-10 baseline. Contact/toss clocks, strokes, grips and movement recipes remain unchanged. Runtime display scale and ground/contact corrections account for the new stature.

Visual review must include front and side ready poses, backhand preparation, serve drop/contact/landing and movement. Numerical anatomy/export checks do not establish visual acceptance.
