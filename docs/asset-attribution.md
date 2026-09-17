# Asset attribution and provenance

This inventory identifies the shipped asset sources; it does not grant a new
license over Tenmulate source code or replace the original third-party notices.
No repository-wide open-source license has been chosen.

## Tennis audio palette (2026-09-17)

The prepared palette uses CC0 recordings by kletton97 (Tennis-Ball-Hit), qubodup
(Well Done) and jayfrosting (Murmur 1.wav), plus authored procedural bounce sounds.
Exact source/license URLs, author, retrieval date, source/output hashes and
transformations are in [audio provenance](../public/assets/audio/provenance.json)
and [the shipped notice](../public/assets/audio/NOTICE.txt). Freesound inputs are
publicly served HQ MP3 previews, not lossless originals; original downloads remain
login-gated. No login was used or bypassed. qubodup's upstream filename still
says CCBY3, but the source page explicitly changed its license to CC0 on 2024-10-05.

Rebuild with Node 24 and FFmpeg using `node scripts/audio/build-palette.mjs`.
The builder verifies source hashes before processing. No external sound service
or credential is required at runtime. Prepared assets are not yet proof of
gameplay integration or owner listening acceptance.

| Content | Source and retained evidence |
| --- | --- |
| Articulated mannequin and skeleton | Quaternius, CC0. [Mannequin notice](../public/assets/opponents/LICENSE.quaternius-mannequin.txt), [base-character notice](../public/assets/opponents/LICENSE.quaternius-neutral-male.txt), [active carrier](../src/content/opponent-asset.json). |
| Tennis motion library | Tenmulate visual-reference-led joint-space authoring; no extracted pose data drives production animation. [Published provenance](../public/assets/opponents/tennis-local-v1.manifest.json), [consumer contract](development/local-motion-pipeline.md). Source video and motion laboratory are separate from this frontend. |
| Outdoor venues | Original parameterized Blender geometry. [Hard court sources](../assets/venues/hard-open-arena/sources.json), [clay sources](../assets/venues/clay-sunset-arena/sources.json), [grass sources](../assets/venues/grass-center-court/sources.json). Reference photography is not distributed as runtime imagery. |
| Concrete material | Poly Haven brushed concrete, CC0; URL, license link and file hashes in the hard-court source record above. |
| Indoor venues | Original Blender scenes and generated material maps; [build and delivery contract](development/indoor-venues-and-performance.md). |
| Seated audience | Original generated paired artwork, converted to delivery atlases. [Prompts and source record](../assets/audience/README.md). |
| Application dependencies | React, Three.js, Lucide and build tools retain their package licenses. Exact versions are locked in `package-lock.json`; inspect each installed package's LICENSE for redistribution terms. |

The release candidate retains model notices and asset manifests. Public provenance
review, source-license choice, owner technique acceptance and target-device review
remain distinct from a successful build or private GitHub upload.
