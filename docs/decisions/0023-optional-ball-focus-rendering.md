# ADR-0023: Optional ball-focus rendering

- Status: Accepted for local implementation
- Date: 2026-09-08

## Context

Practice and drill views need a configurable visual emphasis as a ball approaches
the player's camera. The ball must stay sharp while the surrounding rendered
world softens. Neither the simulation nor the shared court lifecycle should
depend on a visual preference.

## Decision

`TennisScene.setBallFocus` accepts an independent, default-off setting. The
camera-relative distance envelope begins at 16 m and reaches full strength at
2.5 m. View-edge and near-camera falloff avoid a hard cut when a ball passes the
viewer. A short visual attack/release envelope softens flight handoffs; it never
feeds the session clock or trajectory compiler.

Each visible ball retains its standard/high-contrast size and gains a distance-
weighted pale color and emission. `BallFocusPass` renders the world once into a
linear half-float color target with depth. A second pass renders only the ball
geometry into a mask, rejecting fragments behind the recorded world depth. This
mask keeps every visible ball sharp, including overlapping flights and tosses.

Two separable blur passes at half CSS resolution soften the world and spread the
distance-weighted ball mask into a restrained glow. The final composite restores
the sharp ball pixels, then applies the renderer's existing tone mapping and
output color conversion. The blur ceiling is measured in CSS pixels, independently
of adaptive pixel ratio: default 3 px, adjustable from 0 to 6 px. Zero retains ball
brightening/glow with a sharp background. HTML controls and overlays are unaffected.

Inactive focus uses the original direct render path. Targets allocate lazily,
resize with the current drawing buffer, remain resident between active shots,
and dispose on disable or scene disposal. The existing shared-court parking and
document visibility rules suspend all passes. Renderer metrics count all passes.

## Settings ownership

This is a browser-local viewing preference, shared across Practice, drill editing
and playback. Perspective contains the toggle and, directly underneath when on,
its maximum-blur control. The setting is independent of saved shot definitions,
camera-position presets, drill export and undo. Malformed/older preferences
normalize to bounded values and default off; a pending Practice form save must
preserve separately changed focus preferences.

## Consequences

The enabled effect adds one ball-only draw and three fullscreen draws for a single
visible ball, plus five GPU textures. It does not render the stadium twice or add
per-frame React state. This is an artistic focus cue, not optical accommodation
or a physical depth-of-field simulation. Bounded browser checks are distinct from
device thermal testing and owner visual acceptance.
