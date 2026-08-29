# Resolved decisions and open questions

- **Status:** Active decision queue
- **Last updated:** 2026-08-29

## Resolved by the owner on 2026-08-29

| Topic | Decision |
| --- | --- |
| Displays and rooms | Support varied monitors, TVs, projectors, resolutions, computers, viewing distances, and spaces. Provide a realistic default plus adjustable camera position, angle, look target, and FOV/zoom. |
| Users | The owner is the first player; the public product serves players at multiple levels and coaches. Pace, frequency, and other difficulty parameters are configurable. |
| V1 breadth | All previously listed must/should/could features are V1 must-haves, including tactical camera movement, serve-and-volley, volleys, overheads, editor, JSON exchange, offline reuse, variants, and high-refresh mode on capable devices. |
| V1/V2 boundary | V1 is the complete non-tracking product. V2 adds the real-time camera/machine-learning player-movement pipeline and synchronization. |
| Visual style | Game-realistic, with courts as realistic as practical and game-realistic opponents. |
| User handedness | Irrelevant to V1 because no near-player body/swing is rendered. Use court-space targets; do not ask for it. |
| Opponent handedness | Both left- and right-handed opponents must ship. |
| Serve rhythms | Ship normal high-toss/deeper-trophy and compact low-toss/immediate-upward motions; keep motion rhythm independent of ball pace. |
| Release model | V1 is a public free app. Long-term direction is freemium under the same branding and rendering pipeline. |
| Blender MCP | A local asset-production aid only, never part of the shipped browser runtime. |

These decisions are normative in [ADR-0002](decisions/0002-v1-scope-and-release-model.md).

## P0: answer before the vertical slice is scoped

| # | Question | Why it matters | Proposed default |
| --- | --- | --- | --- |
| 1 | Which two or three existing tennis games/videos best express the desired game-realistic opponent, court, lighting, and camera feel? | Makes visual acceptance concrete without requiring photorealism. | One clean practice-court reference plus one game reference emphasizing readable ball/contact timing. |
| 2 | What is the initial asset-production budget band for the bake-off: free/open-source only, up to US$100, up to US$500, or room for a commissioned/licensed athlete? | Changes whether we test hobby SaaS, studio services, or commissioned art/mocap. | Spend a small capped amount across Tripo, Hunyuan/VISVISE, Rodin, and Meshy before commissioning. |
| 3 | Can owner-recorded tennis reference video be uploaded to approved cloud mocap services for the bake-off? | Cloud video-to-motion is the fastest way to compare tennis-specific clips; privacy/source rights must be explicit. | Yes for deliberately recorded, non-sensitive footage with informed participants and reviewed terms; otherwise run local or licensed alternatives. |
| 4 | Which real devices are available for the first performance matrix? | The product supports varied hardware, but the spike still needs reproducible low/mid/high reference tiers. | One mid-tier Windows laptop, one stronger discrete-GPU PC if available, and one lower-power integrated-GPU device connected to at least one 4K display. |
| 5 | Who can provide the first biomechanics/contact review? | An asset can look polished while serving or striking incorrectly. | Owner review plus one coach or advanced player before a motion family is marked accepted. |

## P1: decide during research and the vertical slice

| # | Question | Proposed default |
| --- | --- | --- |
| 6 | Direct Three.js geometry, Blender/GLB, or both? | Hybrid: code-own exact court/net/ball/training markers; GLB for skinned opponents and complex authored props; validate in ADR-0003. |
| 7 | Which generator/mocap chain wins the asset bake-off? | Compare at least one Chinese end-to-end route, one Chinese modular route, one international end-to-end route, and a licensed/commissioned baseline. |
| 8 | What should the default FOV be when no physical display measurements are entered? | Choose from real-screen perception tests; keep the value visible and provide one-action reset. |
| 9 | Which performance tiers and quality presets are promised publicly? | Publish measured tiers after the vertical slice; do not promise universal 4K/120 fps. |
| 10 | Is the first public host a static site plus separate object/CDN assets, or one platform for both? | Affects cache headers, egress, deploy/rollback, and asset URL versioning. | Static app plus immutable versioned object/CDN asset origin. |
| 11 | How many opponent appearances must V1 include? | “Multiple” needs a testable count and asset budget. | Two appearances sharing compatible skeleton/animation data where licensing permits. |
| 12 | Which languages ship in V1? | Public reach and UI/voice-cue scope. | English first, architecture localization-ready; add Chinese if owner wants a bilingual launch. |

## P2: decide before public release

- Brand/project name: whether **Tenmulate** is final and clearable.
- Exact minimum browser/hardware policy and unsupported-device messaging.
- Analytics: none, local diagnostics, or explicit opt-in product analytics.
- Public privacy, acceptable-use, accessibility, asset attribution, and support/error-reporting pages.
- Hosting provider, domain, storage/egress budget, cache policy, deployment cadence, and rollback owner.
- Commercialization sequencing, premium value boundary, account provider, and payment jurisdiction; none is required for public-free V1.
- Whether V2 tracking is strictly on-device and whether frames may ever be stored or uploaded.

## Recommended next decision session

Bring two visual references, the available test-device list, and an approximate asset-spend ceiling. We can then approve the visual target and run the asset/renderer vertical slice without turning any cloud generator into a runtime dependency.
