# ADR-0024: Depth of field and a sharp ball layer

- Status: Accepted for local implementation
- Date: 2026-09-08
- Supersedes: ADR-0023's uniform blur, ball mask and broad glow implementation.
  Its shared, default-off Perspective preference and lifecycle rules remain active.

## Context

Owner review found the first effect blurred the scene uniformly and made the ball
look soft. Its protected center pixels did not establish a visibly sharp silhouette.
The revised effect needs a lens-like focal plane that follows the ball and a ball
layer that is never part of the blur input.

## Decision

Keep the custom WebGL 2 compositor. The installed Three.js BokehPass re-renders the
world with a depth material and performs a 41-color-sample gather. Our renderer
already supplies depth, and the product also requires an independently sharp ball.
Use that existing depth with a bounded, half-CSS-resolution lens approximation.

1. Render world color and depth once. Temporarily suppress ball color/depth writes,
   retaining the ball's shadow in the normal shadow pass.
2. Render the actual balls, using the scene's real lighting, into a separate
   full-resolution MSAA color/coverage target. Reject occluded ball fragments using
   world depth. The stadium and shadow maps are not rendered again in this pass.
3. Downsample world color/depth with a foreground-preserving filter. A stable
   16-point disk gather calculates a circle of confusion from each sample's depth:
   `radius = maximumRadius * clamp(1 - focusDistance / depth, -1, 1)`.
   Negative radii describe foreground defocus, positive radii far defocus, and zero
   keeps the focal plane sharp. Neighbor depth and near-field coverage reduce
   cross-depth color bleeding and soften defocused foreground silhouettes.
4. Composite the lens result, then the sharp ball's premultiplied coverage, then
   apply existing tone mapping and output color conversion. A restrained 1.2 px
   rim stays outside the ball. Reduce emission so it does not erase the silhouette.

The most prominent on-screen ball supplies camera-forward focus distance. Focus
transitions interpolate inverse depth over a short visual interval. Every ball
remains sharp even during a focus handoff or an overlapping flight; no camera,
session, contact or trajectory data is modified.

## Performance and ownership

The lens gather processes one-quarter of CSS pixels, independently of adaptive
pixel ratio. Sharp-ball rendering clears only the union of its previous/current
screen bounds after initial allocation. The composite skips ball/rim texture
lookups outside those bounds. Zero blur skips both half-resolution passes; fully
inactive focus retains direct rendering. Scene/layer/material/clear/shadow state
is restored after the pass, including error paths. Owned resources dispose on
disable and scene disposal; gameplay ball materials/geometry remain scene-owned.

The existing Perspective toggle and 0–6 px maximum remain unchanged. The ceiling
now represents a disk radius rather than the old Gaussian sigma. Saving a shot,
changing mode or exporting a drill still does not change this viewing preference.

## Basis and limits

The distance dependence and near/far separation follow the thin-lens discussion
in [GPU Gems 3, chapter 28](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-28-practical-post-process-depth-field).
The alternative was checked against the installed Three.js source and the
[BokehPass documentation](https://threejs.org/docs/pages/BokehPass.html).
This is a bounded screen-space approximation: it cannot reconstruct hidden geometry
or model every transparent layer of a real lens. Performance claims must name the
tested adapter/resolution and distinguish GPU query results from thermals or FPS.

See the [verification receipt](../development/lens-focus-2026-09-08.md) for the
depth chart, moving-ball pixel equality, actual court and GPU query evidence.
