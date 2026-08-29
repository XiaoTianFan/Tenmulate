# ADR-0006: Nine-venue atmosphere, procedural materials, weather, and wind

- **Status:** Accepted
- **Date:** 2026-08-30
- **Decision owners:** Project owner and implementation lead
- **Extends:** ADR-0005

## Context

The first six code-owned venue passes established regulation court geometry and a reusable scene-composition path, but they did not yet meet the intended game-realistic bar. The outdoor scenes lacked complete environmental context and a sky that participated in illumination. The indoor scenes mixed hall and arena language, visible fixtures were disconnected from actual light sources, and the covered grass roof profile was inverted. Surface texture detail was concentrated on the court instead of forming one coherent material system.

Three owner-supplied arena photographs now establish three additional composition references: an open-roof blue hard-court arena, a sunset clay bowl, and an open-roof grass center court. They are scale, massing, palette, and lighting references only. Logos, sponsor artwork, architecture-specific trade dress, and identifiable venue branding are not copied.

## Decision

1. Ship nine venue identities: six outdoor venues and three simple indoor halls. The first three outdoor settings remain club/park environments; the next three are arena-scale environments calibrated to the owner references. The three indoor settings contain no audience seating.
2. Keep regulation court, net, trajectory, and camera coordinates independent from every venue shell.
3. Use one renderer-owned outdoor atmosphere system based on Three.js `Sky`, a directional sun, hemispheric fill, fog, and a PMREM-derived environment map. Solar elevation/azimuth comes from continuous time-of-day and user light-direction controls. Weather changes the same atmospheric and light state instead of layering a disconnected backdrop over static lighting.
4. Support clear, overcast, and rain visual weather. Rain is a procedural GPU particle field whose slant responds to the configured wind. Wetness changes procedural surface response without changing the selected court physics profile.
5. Express visible scene texture through code-owned shader programs layered onto physically based materials. Court, runoff, ground, walls, roofs, timber, concrete, seating, metal, planting, and ad-board materials use deterministic procedural variation; no downloaded raster texture is required for the venue system.
6. Make every indoor or floodlight source venue-local. Visible lens geometry and its actual Three.js light share the same transform. Scene switching therefore switches both the fixture and its illumination.
7. Rebuild the covered grass hall with a correctly oriented semicircular barrel-vault roof assembled above the court.
8. Add configurable wind direction and strength to the environment contract. Wind is converted to a world-space air-velocity vector and used by the ball solver for drag and Magnus calculations. Authored launch solutions remain calibrated in calm air, so wind visibly and deterministically displaces the simulated trajectory.
9. Treat weather as visual-only in this release except for wind. Rain does not silently change restitution, friction, ball mass, or court pace. A future wet-surface physics profile would require an explicit product and calibration decision.

## Venue catalogue

### Outdoor club and park environments

1. Blue-and-green public club: perimeter fencing, paths, planted buffers, practice buildings, furniture, and light poles.
2. Mediterranean clay terrace: retaining walls, landscaped terraces, access stairs, villa/club context, and court furniture.
3. Grass park: layered trees, hedges, paths, lawn context, service pavilion, fencing, and floodlights.

### Outdoor arena environments

4. Open hard arena: blue hard court, multi-tier blue seating bowl, aisles, concourses, dark ad boards, roof canopies, trusses, and open sky.
5. Sunset clay bowl: clay court, green/tan seating tiers, asymmetric upper decks, score display, ad boards, canopy bands, and open sunset sky.
6. Grass center court: striped grass, green seating bowl, white roof trusses, dark court surround, score displays, ad boards, and a central open roof aperture.

### Indoor halls

7. Timber-and-steel hard-court hall.
8. Simple clay training hall.
9. Barrel-vault grass hall.

## Runtime contracts

- `EnvironmentConfiguration` owns venue, time of day, lighting preset, light direction/intensity, weather/intensity, and wind direction/speed.
- Outdoor venue groups do not create private sky domes. `TennisScene` owns one atmosphere and one weather system so environment-map generation and disposal remain bounded.
- Venue meshes obtain materials from one procedural material library. Shader uniforms are updated for time, wind, and wetness without rebuilding geometry.
- Wind direction uses the player-facing court frame: `0 degrees` blows toward the far opponent (`+z`), `90 degrees` blows to court-right (`+x`).
- Environment persistence is normalized and backward compatible. Missing fields from earlier saved state receive calm, clear defaults.
- Calm-wind trajectories remain backward compatible. Non-zero wind is included in deterministic session settings and solver-version evidence.

## Consequences

### Positive

- Outdoor sky, shadows, ambient fill, fog, reflections, and rain now describe one coherent atmosphere.
- The new arenas gain recognizable scale without external 3D packages or high-egress scene payloads.
- Procedural material detail remains compact, offline-capable, relightable, and tunable per quality tier.
- Fixture/light alignment becomes inspectable in code and cannot drift through independent hard-coded positions.
- Wind has a visible training consequence while preserving deterministic replay.

### Negative

- PMREM updates, shader variants, instanced seating, and precipitation introduce GPU cost that must be measured on supported hardware.
- Programmatic arena composition cannot reproduce every architectural detail in the photographs; visual acceptance is based on hierarchy, scale, palette, atmosphere, and gameplay readability.
- A physically credible atmosphere is not an astronomical or meteorological simulator. Time-of-day is an art-directable solar control.

## Acceptance evidence

- Venue selection exposes nine entries with exactly six outdoor and three indoor definitions.
- Each arena has seating tiers, aisles, surrounding ad boards, roof/canopy massing, access/context, and an open sky aperture.
- Each original outdoor venue reads as a complete environment beyond isolated trees.
- Indoor scenes contain no audience stands; visible fixture lenses coincide with their light sources; the grass hall roof forms an upright semicircular vault.
- Clear, overcast, and rain states alter sky/light/fog/material response; rain direction changes with wind.
- A non-zero side wind measurably changes bounce position and is exactly repeatable for the same settings.
- Court dimensions and calm-air trajectory goldens remain green.
- Production build, unit tests, browser console, interaction flow, and reference-to-render screenshots are recorded in development evidence.
