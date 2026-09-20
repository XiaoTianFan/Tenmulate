# Asset attribution

This inventory identifies shipped sources. It does not grant a license over
Tenmulate source code or replace original third-party notices. No repository-wide
open-source license has been selected.

## Opponent

The articulated mannequin is based on Quaternius's CC0
[Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html).
The skeleton source comes from the CC0
[Universal Base Characters Kit](https://quaternius.com/packs/universalbasecharacters.html).
The original base character is a source carrier, not the current displayed model.
The tennis motion library is visual-reference-led authored animation, not extracted
player motion capture. Model licensing does not imply rights to source footage.

- [Mannequin notice](../public/assets/opponents/LICENSE.quaternius-mannequin.txt)
- [Base-character notice](../public/assets/opponents/LICENSE.quaternius-neutral-male.txt)
- [Character source record](../scripts/characters/source.json)
- [Active model](../src/content/opponent-asset.json) and
  [motion manifest](../src/content/opponent-motion.json)
- [Published motion provenance](../public/assets/opponents/tennis-local-v1.manifest.json)

## Audio

The current recorded-contact bank contains twelve independent forehand, serve and
slice excerpts from Jamesdrake89's CC0 tennis recordings. Crowd sources are
qubodup's **Well Done** and jayfrosting's **Murmur 1.wav**, also CC0. Bounces and
environmental layers use authored synthesis. Contact excerpts use publicly served
HQ MP3 previews; they are not lossless original recordings.

The [shipped notice](../public/assets/audio/NOTICE.txt) and
[audio provenance](../public/assets/audio/provenance.json) retain source/license
URLs, authors, hashes and transformations. The former kletton97 contact source is
historical provenance, not the current twelve-take contact bank. Volley/drop-shot
and overhead mappings reuse related recorded families; they are not separately
recorded or calibrated examples of every shot type.

## Venues and audience

Venues use original parameterized Blender geometry. Reference photography is not
distributed as runtime imagery. Poly Haven's brushed-concrete material is CC0;
source links, license and hashes are retained in the source records.

- [Hard-court sources](../assets/venues/hard-open-arena/sources.json)
- [Clay-court sources](../assets/venues/clay-sunset-arena/sources.json)
- [Grass-court sources](../assets/venues/grass-center-court/sources.json)
- [Audience source record](../assets/audience/README.md): generated seated artwork
  converted to delivery atlases.

Indoor venues use authored scenes and generated material maps. Active venue
manifests and delivery assets retain their source metadata.

## Dependencies and reuse

React, Three.js, Lucide and build tools retain their package licenses. Exact
versions are locked in `package-lock.json`; consult each package's LICENSE for
redistribution terms. Keep notices and provenance with redistributed assets.
Broader licensing and distribution questions remain listed in
[open work](open-questions.md).
