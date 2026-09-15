# Resolved decisions and open questions

- **Status:** Active decision queue
- **Motion decisions reconciled:** 2026-09-07; unrelated questions retain their original scope

## Resolved by the owner on 2026-08-29

**Superseding owner direction, 2026-09-05:** [ADR-0012](decisions/0012-local-opponent-motion-pipeline.md) authorizes local inference/authoring using two supplied practice videos in the sibling motion-analysis lab. The historical Cloud generation/Reference upload rows below no longer govern motion implementation. No cloud mocap uploads or purchases are planned. Public asset provenance remains a release review item, not a prerequisite for this authorized local laboratory work.

| Topic | Decision |
| --- | --- |
| Displays and rooms | Support varied monitors, TVs, projectors, resolutions, computers, viewing distances, and spaces. Provide a realistic default plus adjustable camera position, angle, look target, and FOV/zoom. |
| Users | The owner is the first player; the public product serves players at multiple levels and coaches. Pace, frequency, and other difficulty parameters are configurable. |
| V1 breadth | All previously listed must/should/could features are V1 must-haves, including tactical camera movement, serve-and-volley, volleys, overheads, editor, JSON exchange, offline reuse, variants, and high-refresh mode on capable devices. |
| V1/V2 boundary | V1 is the complete non-tracking product. V2 adds the real-time camera/machine-learning player-movement pipeline and synchronization. |
| Visual style | Game-realistic, with courts as realistic as practical and a neutral faceless opponent whose motion and silhouette read clearly from the far baseline. |
| User handedness | Irrelevant to V1 because no near-player body/swing is rendered. Use court-space targets; do not ask for it. |
| Opponent handedness | Both left- and right-handed opponents must ship. |
| Serve rhythms | Ship normal high-toss/deeper-trophy and compact low-toss/immediate-upward motions; keep motion rhythm independent of ball pace. |
| Release model | V1 is a public free app. Long-term direction is freemium under the same branding and rendering pipeline. |
| Blender MCP | A local asset-production aid only, never part of the shipped browser runtime. |
| Bake-off budget | Hard cap below US$100; current envelope is US$99 with no automatic renewals. |
| Motion production | Local visual-reference authoring, anatomical fitting and Blender baking under ADR-0012. Optional pose diagnostics do not drive production. No cloud mocap upload/purchase is required. |
| Reference upload | Cloud mocap upload is allowed only for footage with explicit upload, derivative-use, likeness, and commercial rights. Public professional footage is not assumed to be cleared. |
| Court scenes | V1 includes outdoor, indoor club-hall, and indoor-stadium shells combined with hard, clay, and grass, plus umpire/rest seating and spectator stands without crowd models. |
| Lighting | Outdoor supports sun direction and day/night/floodlights. Indoor supports fixture controls and applicable daylight/roof influence. |
| World generation | Closed on 2026-08-30: generated worlds and Gaussian splats are not spatially usable for this product and leave the runtime. |
| Initial court | All six concept directions remain in scope; outdoor Panel 1, the bright blue/green public-club hard court, is the product and vertical-slice baseline. |

The release/scope decisions are normative in [ADR-0002](decisions/0002-v1-scope-and-release-model.md); later visual and asset choices are linked to their specific concept/research records.

## P0: answer before the vertical slice is scoped

| # | Question | Why it matters | Proposed default |
| --- | --- | --- | --- |
| 2 | Which indoor language leads: intimate timber/steel club hall or empty tournament stadium? | Selects architecture, seating density, acoustics, and the second venue-shell experiment. | Club hall first for training clarity; stadium remains a required V1 shell. |
| 3 | Which real devices are available for the first performance matrix? | The product supports varied hardware, but the spike still needs reproducible low/mid/high reference tiers. | One mid-tier Windows laptop, one stronger discrete-GPU PC if available, and one lower-power integrated-GPU device connected to at least one 4K display. |
| 4 | Who can provide the first biomechanics/contact review? | An asset can look polished while serving or striking incorrectly. | Owner review plus one coach or advanced player before a motion family is marked accepted. |
| 5 | Closed for local implementation; public provenance review remains. | Owner-supplied local Djokovic/Kyrgios references and the CC0 mannequin support the authorized lab. | Preserve source receipts; assess public distribution separately from local authoring. |

## P1: decide during research and the vertical slice

| # | Question | Proposed default |
| --- | --- | --- |
| 6 | Direct Three.js geometry, Blender/GLB, or both? | Hybrid: code-own exact court/net/ball/training markers; GLB for skinned opponents and complex authored props; validate in ADR-0003. |
| 7 | Closed: local reference-led motion and articulated CC0 model. | ADR-0012/0014 and the current motion runbook supersede the provider bake-off. |
| 7a | **Closed:** canonical typed Three.js composition wins. | ADR-0005 records the decision; generated outputs remain visual references only. |
| 8 | What should the default FOV be when no physical display measurements are entered? | Choose from real-screen perception tests; keep the value visible and provide one-action reset. |
| 9 | Which performance tiers and quality presets are promised publicly? | Publish measured tiers after the vertical slice; do not promise universal 4K/120 fps. |
| 10 | Is the first public host a static site plus separate object/CDN assets, or one platform for both? | Affects cache headers, egress, deploy/rollback, and asset URL versioning. | Static app plus immutable versioned object/CDN asset origin. |
| 11 | How many opponent appearances must V1 include? | “Multiple” needs a testable count and asset budget. | Two appearances sharing compatible skeleton/animation data where licensing permits. |
| 12 | Which languages ship in V1? | Public reach and UI/voice-cue scope. | English first, architecture localization-ready; add Chinese if owner wants a bilingual launch. |
| 13 | Resolved: two-handed groundstroke; a dedicated one-handed groundstroke remains future work. | Current backhand volley and slice contacts are one-handed. | Keep the groundstroke proxy explicit until separately authored and verified. |

## P2: decide before public release

- Brand/project name: whether **Tenmulate** is final and clearable.
- Exact minimum browser/hardware policy and unsupported-device messaging.
- Analytics: none, local diagnostics, or explicit opt-in product analytics.
- Public privacy, acceptable-use, accessibility, asset attribution, and support/error-reporting pages.
- Hosting provider, domain, storage/egress budget, cache policy, deployment cadence, and rollback owner.
- Commercialization sequencing, premium value boundary, account provider, and payment jurisdiction; none is required for public-free V1.
- Whether V2 tracking is strictly on-device and whether frames may ever be stored or uploaded.

## Recommended next decision session

Review the two generated court boards and choose the first outdoor and indoor north stars. Then identify available test devices, the first biomechanics reviewer, and either a rights-cleared performer/capture plan or a specifically licensed source clip. The US$99 envelope and world/character/motion test order are ready once those gates are answered.

## Hosting decisions — 2026-09-16

GitHub public visibility, Vercel hosting and `tenmulate.xiaotianfanx.com` are decided
and live. A separate asset host is not required. Repository-wide licensing, broader
asset-rights review and target-device acceptance remain open. Current authority:
[release runbook](development/release.md).
