# Cloud mocap to web opponent: production contract

- **Status:** Proposed pipeline; hands-on tennis bake-off pending
- **Research date:** 2026-08-29
- **Priority:** motion silhouette, rhythm, footwork, racket path, and contact fidelity over close-up facial detail

## 1. The short answer

A generated 3D model and a mocap result are different assets:

- The **mesh** is the visible triangles.
- **UVs and PBR textures/materials** define base color, normal detail, roughness, metallic response, and occlusion.
- The **skeleton/armature** is the named bone hierarchy.
- **Skin weights** bind each mesh vertex to one or more bones. Mesh + armature + weights is a **skinned mesh** or rigged character.
- The **mocap animation** is time-varying bone motion, commonly delivered as FBX or BVH and sometimes GLB.
- **Retargeting** maps motion from the mocap source skeleton to Tenmulate's canonical target skeleton.
- The final web asset is an optimized **GLB** carrying the skinned opponent, PBR materials/textures, and one or more animation clips, or a compatible base GLB plus separately cached animation GLBs.

The model generator does not need to generate the finished tennis animation. It must provide a clean humanoid in a known rest pose with usable topology, separated racket/apparel parts where needed, a rig or riggable mesh, and clear commercial rights. A motion service can then produce the bone motion, which is retargeted and cleaned in Blender.

## 2. Canonical production chain

```text
rights-cleared reference/capture
  -> cloud video-to-motion solve (FBX/BVH/GLB)
  -> cloud-generated or licensed humanoid mesh
  -> rig/skin normalization to Tenmulate skeleton
  -> retarget source motion to target skeleton
  -> tennis cleanup + root motion + foot locking + racket path
  -> toss/contact/recovery event markers
  -> Blender production master
  -> optimized GLB/KTX2 + metadata + immutable CDN
  -> Three.js AnimationMixer at runtime
```

Blender remains the production truth and validation gate; it is not an inference model or runtime dependency. Cloud-only means no generator or mocap model is run on local GPUs. It does not prohibit local DCC cleanup and export.

## 3. What to request from the model generator

### Required for the first opponent

- neutral A- or T-pose;
- anatomically credible game-realistic proportions and readable silhouette at the far baseline;
- closed, manifold-enough mesh with deformation-friendly shoulders, hips, elbows, knees, wrists, and ankles;
- clean UVs and a compact PBR material set;
- neutral tennis apparel without protected logos or a recognizable professional player's likeness;
- separated or replaceable racket and practical apparel/hair pieces;
- rig/skin if its quality passes, otherwise a mesh that survives an independent auto-rig;
- FBX or GLB export plus source/license/provenance record.

### Optional, not purchase priorities

- facial rig, pore-scale skin detail, strand hair, or 4K/8K facial textures;
- generator animation presets that do not cover tennis mechanics;
- complex part segmentation beyond apparel/color variants.

Because the opponent is normally more than a court length away, spend the budget on deformation and motion cleanup before high-resolution textures. The bake-off should test a roughly 20k–50k triangle primary opponent LOD, one compact material atlas, and 1K/2K texture variants rather than assuming a marketing “high-poly” output is better. Final limits come from actual 4K screen captures and frame-time evidence.

## 4. Canonical skeleton and runtime assets

The target skeleton must be source-independent and versioned. It needs a single root, pelvis/hips, spine/chest/neck/head, complete arms/hands, legs/feet/toes, and stable racket sockets for both hands. Finger bones are optional for V1 unless their silhouette materially improves the serve/racket grip at gameplay distance.

Recommended first vertical slice:

```text
opponent-v1.glb
  mesh + PBR materials + armature + skin weights
  idle + forehand + normal serve + compact serve clips
racket-v1.glb
  rigid prop attached to handed socket
opponent-v1.animations.json
  clip IDs, handedness, root-motion policy, playback bounds,
  toss release, trophy, contact, recovery, and foot-plant markers
```

Use one combined GLB first because it removes skeleton-sharing ambiguity. After the contract passes, split reusable appearance and animation packs only if measured caching benefits justify it. Every split animation file must target the exact same bone names, hierarchy, rest pose, scale, and skeleton version.

glTF/GLB is the runtime canonical format because it represents scenes, meshes, PBR materials, textures, skins, and animations and is designed for compact runtime delivery. FBX and BVH are interchange inputs, not public runtime contracts. Blender's exporter can bake deformation-bone animation and skinning; Three.js `GLTFLoader` exposes the clips to `AnimationMixer` and supports KTX2, Draco, and meshopt integration.

## 5. Retargeting and cleanup in practice

1. **Normalize units and rest pose.** Put both source and target at meter scale, align axes, and match A/T pose without changing limb proportions silently.
2. **Map bones.** Build a saved source-to-target map for hips, spine, shoulders, limbs, feet, and optional fingers.
3. **Choose root motion deliberately.** Preserve meaningful tennis displacement as a root-motion curve, then place the opponent so the contact point matches the authored court coordinate. Do not mix in-place and moving-root clips accidentally.
4. **Bake onto the target rig.** The generator/mocap skeleton is discarded as runtime authority after the cleaned target action is baked.
5. **Repair the tennis failure points.** Lock planted feet; correct hip/shoulder sequencing; remove limb pops; preserve racket-side elbow/wrist orientation; repair toss arm, trophy depth, contact reach, follow-through, recovery, and split-step timing.
6. **Attach the racket.** Mocap normally tracks the body, not a racket. Attach a separate racket rigidly to a named hand socket and animate any grip/socket correction.
7. **Handle the serve ball.** Before contact, render the simulation ball under a kinematic toss curve tied to the toss-release marker. At the contact marker, hand control to the deterministic flight solver without duplicating or teleporting the ball.
8. **Mark semantic events.** Preparation start, plant, toss release, trophy, contact, recoverable end, and valid rate bounds are data, not guessed from runtime clip progress.
9. **Review twice.** Frame-step the string-bed/ball distance and watch at normal speed from the real gameplay camera. Both must pass.

## 6. Cloud mocap shortlist under the cap

| Service | Current cloud offer | Export/integration | Tennis assessment |
| --- | --- | --- | --- |
| **Rokoko Vision 3.0/Create** | 30 seconds/month free; Basic currently US$12 monthly or US$10/month billed annually for 600 seconds. | FBX/BVH; choose HIK/Mixamo skeletons; custom-character retargeting in the paid Basic tier. | Best-value first pass. Fast iteration and cleanup loop; no Vision finger tracking at launch, so racket/toss detail still needs manual repair. |
| **Move One** | Free one-time credits; Starter currently US$18/month plus VAT for 60 credits. | FBX plus Blender export/retarget documentation and additional Move Platform formats. | Good quality comparison. Official capture guidance asks for locked, centered, landscape Full HD at at least 60 fps; broadcast clips often violate this. |
| **DeepMotion Animate 3D** | Free personal/non-commercial tier; commercial paid tiers start at US$9/month billed annually. | FBX, BVH, and GLB; upload a custom rigged FBX/GLB character. Higher plans accept 60–240 fps. | Strong format coverage and direct custom-character test. Confirm actual checkout commitment and commercial plan before paying. |
| **Plask Motion** | Free 15 seconds/day; Standard listed at US$18/month billed annually. | FBX, GLB, BVH; full-body/hand and multi-person capture. | Useful free comparison, especially hand capture. Annual billing makes it a poor first paid choice under this cap. |

Run the same 6–10 second forehand and serve clips through free tiers first. Pay for Rokoko Basic and Move One Starter only when the free result proves the source footage is usable. Total motion allocation remains US$30.

## 7. Source-video standard

### Production capture

- rights-cleared player, location, apparel, and footage release;
- locked camera, landscape, full body and racket visible for the whole clip;
- 60 fps or higher where the provider supports it, short shutter, bright even lighting, little motion blur;
- sufficient margin around racket tip and both feet;
- simple background and minimal body/racket occlusion;
- one isolated stroke plus approach/recovery per take;
- ideally synchronized three-quarter/front and side views if a multi-view service is evaluated.

### Professional-player footage

Professional match footage is excellent **view-only biomechanics reference**. It is not automatically rights-cleared for download, cloud upload, derivative motion extraction, or commercial use. YouTube's current terms restrict downloading, reproducing, altering, or otherwise using content unless the service, rights holders, or applicable law permits it. Mocap services also make the uploader responsible for source rights: for example, Move AI warrants that video/output use does not infringe third-party rights, and Plask requires uploaders to hold copyright/privacy rights.

Therefore:

- do not download and upload broadcast/YouTube clips merely because they are public;
- obtain a license or written permission that covers cloud processing and derivative animation before extraction;
- otherwise use the pro clip as a side-by-side reference while a rights-cleared player performs the movement for capture;
- keep the resulting character generic and do not reproduce a professional player's likeness, apparel marks, or identity without separate rights.

This is a project risk gate, not legal advice; production use should be reviewed for the chosen footage, provider terms, and release jurisdiction.

## 8. Tennis-specific bake-off

Use three short rights-cleared clips:

1. open-stance forehand with lateral recovery;
2. normal serve with high toss and deeper trophy position;
3. compact serve with low toss and immediate upward swing.

Score each provider on:

- foot plant and slide;
- pelvis/torso/shoulder sequencing;
- racket-hand path and contact reach;
- toss arm and trophy pose;
- root translation and court placement;
- temporal jitter and joint pops;
- retarget deformation on the same target character;
- cleanup minutes to an accepted result;
- export consistency and metadata preservation;
- paid cost, source/output rights, and retention terms.

The winner is the lowest total cost to an accepted clip, not the prettiest raw preview.

## 9. Primary sources

- [Khronos glTF runtime asset format](https://www.khronos.org/gltf/)
- [Blender glTF 2.0 exporter](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Rokoko Vision 3.0 and pricing](https://www.rokoko.com/products/vision)
- [Move One pricing](https://docs.move.ai/knowledge/move-one-pricing)
- [Move One file upload guidance](https://docs.move.ai/knowledge/single-file-upload)
- [Move AI API EULA](https://move.ai/move-one-api-eula)
- [DeepMotion Animate 3D pricing and formats](https://www.deepmotion.com/pricing-animate3d)
- [DeepMotion custom-character FAQ](https://www.deepmotion.com/post/animate-3d-custom-characters-faq)
- [Plask pricing](https://plask.ai/en-US/pricing)
- [Plask terms](https://plask.ai/en-US/docs/100002)
- [YouTube terms](https://www.youtube.com/t/terms)

Provider pricing, terms, and features can change. Recheck them at account signup, at each paid test, and before a clip enters a public build.
