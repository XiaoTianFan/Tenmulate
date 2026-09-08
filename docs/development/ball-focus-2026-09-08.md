# Ball-focus verification — 2026-09-08

**Historical first implementation.** Later owner review found the uniform blur
and broad glow made the ball look soft. Center-mask checks below were insufficient
to establish silhouette quality. [ADR-0024](../decisions/0024-depth-of-field-and-sharp-ball-layer.md)
and the [lens-focus receipt](lens-focus-2026-09-08.md) describe the replacement and
its full ball-layer and final-output pixel checks.

## Delivered behavior

Practice, drill editing and playback share **Perspective → Ball focus**. Enabling
it reveals **Maximum blur** immediately below the toggle, adjustable in 0.5 px
steps from 0 to 6 px. New and migrated preferences start off with a 3 px ceiling.
The setting persists locally across modes and reloads. It is a viewing preference,
so it does not become a shot override or a drill undo operation.

An approaching ball becomes pale yellow-white with stronger emission and glow.
The surrounding world gradually softens as camera-relative distance decreases;
ball pixels remain sharp. The envelope begins at 16 m and reaches full strength
at 2.5 m, with a short release as the ball passes or leaves view. Zero maximum blur
keeps the background sharp while retaining ball emphasis. HTML controls stay sharp.

## Implementation

- `ballFocus.ts`: bounded settings, smooth distance/view envelope and visual
  attack/release. No changes to trajectories, contacts, animation or session clocks.
- `BallFocusPass.ts`: one linear half-float world render with MSAA/depth, one
  ball-only mask, two separable blur passes at half CSS resolution, and a composite
  with existing exposure/tone mapping/output color space. Mask comparison accounts
  for the local multisample depth slope, preventing the near sphere from masking
  itself while preserving actual occluders.
- `TennisScene`: per-ball material emphasis composes with high-contrast sizing;
  every visible ball/toss is protected. Resources allocate lazily, resize with the
  drawing buffer and dispose on disable or scene disposal. Shared-court parking
  and hidden-document suspension remain authoritative.
- `BallFocusControls`, `SharedCourt`, `SceneViewport`, `useAppData`: one preference
  and one renderer command across modes. A delayed practice form save preserves
  independently changed focus preferences.

## Verification

`npm test`: **313 passing tests in 31 files**. New coverage checks migration,
malformed preferences, blur clamping, distance/view falloff, and frame-rate-independent
handoff smoothing. `npm run build` passes TypeScript, production bundling and the
active opponent asset/cache guard. The existing renderer chunk-size advisory remains.

Regular Playwright/Chrome was used for isolated browser checks because the named
Browser testing plugin is not installed. The actual user preview is served at
`http://127.0.0.1:5173/`; an isolated source harness used a temporary Vite server
at 4186 with the production `TennisScene` and authored venue/opponent assets.

| Check | Observed result |
| --- | --- |
| Practice, editor, drill-playback toggle/slider | Same canvas instance across route changes; unchanged session revision and advancing clock when focus changes |
| Pending practice form save → Editor | Updated focus preference survives the delayed save |
| Reload, keyboard, 1600×1000 desktop, 390×844 phone | Preference round-trip, Space toggle and arrow-key slider pass; no horizontal overflow |
| Distant frame, effect off/on | Identical PNG bytes; original direct render path |
| Near ball, 3 px and 6 px | Mask center `[255,255,0,255]`; sharp ball retained, background edge contrast reduced |
| Near ball, 0 px | Bright ball retained with sharp background |
| Opaque object in front of ball | Zero visible ball-mask pixels; no glow through the occluder |
| Resize + 1.5 pixel ratio | Color/mask 1170×1266, blur targets 390×422; sharp-mask readback passes |
| Three enable/disable cycles | Texture counts alternate 17/12 without growth; pass reference released |
| One visible ball | 198 → 202 draw calls, 411917 → 412640 triangles; no second stadium render |
| Browser and GPU errors | No page/console errors; WebGL error code zero |

In the fixed near-ball comparison, ball-center luminance rose from **190.9 to
238.3** (8-bit weighted RGB). Mean background edge contrast in a fixed seating
region fell from **5.50 to 1.03** at 3 px. At zero blur it stayed sharp (5.99;
the target path uses separate MSAA). Screenshots were visually inspected from
the actual player camera, including the luminous ball and Perspective controls.

Browser render-submission timing varied substantially even between consecutive
off runs; these samples are retained for transparency but are not accepted as
GPU frame-time or thermal qualification. Resource/pass counts are bounded evidence,
not a promise of identical performance on every device.

## Evidence location and scope

Local artifacts are outside the repository:
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/ball-focus/`.

- `render-qa.mjs`, `render-result.json`: production renderer, depth/mask readback,
  range cases, resize, cleanup and raw submission timing.
- `ui-qa.mjs`, `ui-result.json`: production UI interactions, persistence, identity,
  desktop/phone and keyboard checks.
- `pixel-qa.mjs`, `pixel-result.json`: fixed-frame image comparisons.
- `far-off/on.png`, `mid-on.png`, `near-off/on/max/zero.png`: renderer comparisons.
- `practice-perspective.png`, `editor-perspective.png`, `drill-settings.png`,
  `practice-mobile.png`, `editor-mobile.png`: visible controls.

Implementation and local verification are complete. Device thermal testing, owner
visual acceptance, remote push and public deployment are separate states.
