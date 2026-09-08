# ADR-0028: Filtered net weave across camera perspectives

- Status: Accepted for local implementation
- Date: 2026-09-08
- Supersedes: Drawing the unfiltered geometric/cutout weave from ADR-0013's venue variants. Authored venue ownership and registration remain.

## Decision

Both venue variants use one runtime cord surface after the registered GLB loads.
It follows the source weave's bounds, nominal 42 mm pitch, 2.2 mm cord radius and
156 mm center sag. Authored tape, posts, center strap, court and furniture remain.
The original weave is hidden and remains owned by the venue for disposal. This is
a filtered presentation of the authored net, not a second venue or gameplay net.

The shader integrates each periodic thread over its pixel footprint using
derivatives and an analytic box integral. Fine threads converge to their average
coverage instead of vanishing at an alpha cutoff. The two thread directions combine
as coverage; no alpha test, repeating texture or scene postprocessing is required.
The transparent, depth-tested surface uses one pass with depth writes disabled.
It has 98 vertices and 96 triangles. Both quality modes use the same method.

This applies the analytic procedural-filtering approach described in
[PBRT's procedural texturing chapter](https://www.pbr-book.org/3ed-2018/Texture/Solid_and_Procedural_Texturing).
[Three.js material documentation](https://threejs.org/docs/pages/Material.html)
describes the alpha-test discard behavior involved in the old cutout failure.
No GLB, Blender master, collision coordinate or opponent asset is changed.

## Verification

- Two fixture tests cover transformed registration, sag, tape preservation and
  disposal ownership for both source roles.
- Actual Chrome/WebGL captures compare old/new weave in wide, baseline, close and
  corner views for Quality and Performance. Old Performance weave has zero visible
  contribution in the wide/corner views; the replacement remains visible.
- 168 FOV/resolution combinations cover 30–140 degrees at 0.8, 1.0 and 1.3 pixel
  ratios. Old Performance disappears in 116 samples; the filtered net in none.
- All six venues in both variants load exactly one active filtered net with no GL
  or browser errors. Close-view inspection confirms a continuous woven pattern.
- In the measured hard-arena comparisons, render calls decrease by one; triangles
  decrease by 32 in Performance and 34,896 in Quality. These are work counts, not
  device FPS/thermal guarantees. The production build and asset/cache guard pass.

The Browser plugin was unavailable; regular Playwright used a temporary source
harness and the existing production preview. Scripts, JSON readbacks and images:
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/interval-motion-net/renderer-qa.mjs`
and `renderer-result.json` in the same directory. Local implementation/verification
does not imply owner acceptance or public deployment.
