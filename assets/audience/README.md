# Original seated spectator artwork

Generated with the built-in image-generation tool on 2026-09-05 for Tenmulate.
No third-party spectator photograph, trademark or stadium image is distributed.

`spectators-front.png` and `spectators-back.png` are paired 4 x 4 atlases, with
sixteen adults in seated/resting/waving poses and varied unbranded summer attire.
The generated source is 1254 px square. Requests for actual transparent alpha
twice returned a printed checkerboard; those rejected attempts are not shipped.
The accepted sources use a flat magenta chroma key, removed by the runtime GPU
cutout shader (not blended rectangles). Front/back selection follows the seat's
orientation. No AI image API key is required to rebuild the delivery encodings.

Run `node scripts/blender/prepare_audience.mjs` to mechanically resize/encode the
accepted artwork as 1024 px Quality and 512 px Performance WebP companions.
Art direction changes require a new image-generation edit, not this encoder.

## Prompt sequence

1. Generate: production game spectator sprite atlas, one square image, exact
   regular four columns by four rows, sixteen isolated seated adults, entire
   body visible, facing camera orthographically, invisible chairs, neutral
   diffuse light. Same scale and generous cell margins. Realistic lightly
   simplified people, varied skin tones, ages and hair; navy, ivory, muted red,
   teal, olive, mustard and denim clothes. Hands on thighs or together; four
   people waving. No standing people, chairs, stadium, shadows, branding or text.
2. Accepted background edit: change only the background and gaps between limbs
   to perfectly flat RGB(255,0,255), #FF00FF. Preserve all sixteen people, poses,
   clothes, scale and exact grid positions. No checkerboard or shadows. This is
   a game atlas for shader-based chroma-key cutout.
3. Rear companion: show the same sixteen people from behind, turned 180 degrees
   away. Match clothes, hair, body size, seated pose and raised arm per cell.
   Backs of heads and shirts visible, no faces. Keep exact four-by-four grid,
   positions and scale, invisible chairs, solid #FF00FF background, no text.

The original generation prompt is also retained in `generation-prompt.txt`.
These are economical 2D impostors, not close-up volumetric characters: extreme
side views reveal their thin silhouette. Motion is subtle upper-body sway;
raised-arm poses are artwork variants, not skeletal waving animation.
