# Ball and opponent visibility calibration

- **Status:** Implemented renderer calibration
- **Research date:** 2026-08-31
- **Scope:** Presentation only; no trajectory, collision, opponent scale, or animation changes

## Source boundary

Appendix I of the [2026 ITF Technical Booklet](https://www.itftennis.com/media/15639/2026-technical-booklet.pdf) permits an approved adult tennis ball to be white or yellow and requires a uniform fabric cover. It does not publish a Pantone, RGB, chromaticity, luminance, or fluorescence target. The runtime must therefore not describe any exact digital color as an ITF color value.

Manufacturer language provides a useful appearance cue rather than a governing specification. HEAD describes most competition balls as neon yellow, also called [optic yellow](https://www.head.com/en_US/rs/stories/how-to-choose-a-tennis-ball). That supports a visible yellow-green presentation but does not turn one display color into a measured physical standard.

## Renderer contract

- The standard ball uses sRGB authoring color `#D6FF3F`, a restrained green emissive contribution, and high roughness. The high-contrast accessibility mode keeps the same yellow-green family while increasing scale and emissive lift.
- Trajectory and optional trail colors use the same optic family so the visual cue does not jump back to pure yellow.
- Emission approximates the perceptual visibility of bright felt under scene lighting; it is not a simulation of fluorescent dye, UV response, or display-independent luminance.
- The opponent uses a relightable warm-white PBR fill (`#F7F6EF`) and a near-black (`#050709`) inverted-hull outline.
- Each outline mesh shares the source skinned mesh geometry and skeleton. Vertex expansion is converted from a 45 mm renderer-space width into the asset's pre-normalization scale, so animation and future mocap remain aligned.
- The outline is back-face only, depth-tested, non-depth-writing, non-tone-mapped, and exempt from scene fog. It cannot cast a shadow, participate in collisions, change opponent bounds, or affect ball physics.

The 45 mm hull is intentionally a visibility calibration rather than anatomical geometry. An initial 18 mm pass collapsed below one pixel at the far baseline; browser comparison increased it until the dark contour survived normal gameplay distance without obscuring the white fill.

## Remaining gates

- Owner review on the target monitor/TV under Outdoor Arena and Indoor Court lighting.
- Current Chrome/Edge, Firefox, and Safari comparison because tone mapping, antialiasing, display gamut, and scaling can change the perceived optic color and contour thickness.
- Future mocap/racket clips must verify that the shared-skeleton outline does not reveal mesh seams or detach at extreme poses.
