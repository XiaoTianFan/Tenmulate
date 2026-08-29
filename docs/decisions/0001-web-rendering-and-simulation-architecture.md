# ADR-0001: Web rendering and simulation architecture

- **Status:** Accepted for the V1 runtime; release-device validation remains open
- **Date:** 2026-08-29
- **Decision owners:** Project owner and implementation lead

## Context

The product needs a first-person 3D court, animated opponent, high-speed tennis ball with spin and bounce, deterministic drill timelines, large-screen performance, and a future path to body tracking. WebGPU is attractive but still uneven across devices, and Three.js documents important differences between its mature WebGL renderer and experimental WebGPU renderer. Generic rigid-body physics does not directly solve authored tennis trajectories.

## Decision

1. Use React, TypeScript, and Vite for the application shell.
2. Integrate Three.js directly behind an engine adapter whose interface is independent of React.
3. Use Three.js `WebGLRenderer` and WebGL 2 as the V1 runtime baseline. The implemented scene adapter contains renderer ownership, quality scaling, and failure handling so the renderer can be reconsidered without moving simulation state into React.
4. Defer `WebGPURenderer` to a measured post-V1 upgrade spike. It is not a public-release dependency; a future comparison must use the production opponent and venue asset mix rather than a synthetic empty-court benchmark.
5. Implement the tennis ball as a custom fixed-step 3D numerical model with gravity, drag, Magnus lift, exact court/net events, and calibrated bounce response.
6. Use Rapier only if later collision-heavy features justify a general physics world.
7. Use code-generated parametric court primitives plus Blender-validated GLB for skinned opponents and complex assets, with explicit animation contact, handedness, and serve-rhythm metadata. The source generator/model remains open until ADR-0003's bake-off.
8. Keep camera-based player tracking behind a future worker-isolated adapter and out of V1; it is the defining V2 boundary.

## Rationale

- Three.js directly matches the requested stack and offers a compact code-first runtime.
- The complete code-owned V1 vertical slice initializes and runs reliably through the mature WebGL 2 path, and the researched splat integration options currently have their clearest Three.js path through `WebGLRenderer`.
- React remains useful for product UI without becoming the simulation clock.
- A tennis-specific solver can be validated against published equations, ITF bounds, landing targets, and expert perception.
- GLB is the best-supported runtime delivery format across Blender and Three.js for skinned/animated assets.
- Deferring body tracking protects V1 performance, privacy, and scope.

## Alternatives considered

### Three.js `WebGPURenderer` as the initial renderer

Strategically attractive, but it adds a second source of uncertainty before the production GLB/splat workload exists. The option remains open behind the renderer boundary after the representative asset mix can be measured.

### React Three Fiber

Strong declarative composition and ecosystem. Deferred during the risk spike to keep renderer, clock, and high-frequency simulation ownership explicit. It may be adopted later if a small comparison proves clearer without changing outcomes.

### Babylon.js

More built-in game/animation/physics systems and mature WebGPU support. It is a credible fallback if Three.js fails the spike, but its larger engine surface is not yet justified.

### PlayCanvas

Strong browser-first engine and editor workflow. Best if visual authoring becomes a primary team requirement; otherwise it adds another content/source-of-truth decision.

### Rapier/cannon-es for the tennis ball

Useful collision engines, but neither removes the need for custom aerodynamic forces, target solving, spin-aware bounce calibration, or deterministic shot authoring. The core ball model stays domain-specific.

### Hand-authored splines

Guaranteed endpoints but weak physical meaning and poor generalization. Allowed only for camera paths or temporary concept prototypes.

## Consequences

### Positive

- Explicit, testable boundaries among UI, timeline, simulation, animation, camera, and rendering.
- Deterministic content definitions and replay.
- Renderer migration remains localized.
- Public-free V1 can deploy as a static front-end application with separately cached versioned assets.
- Future camera/ML work does not contaminate initial privacy or performance.

### Negative

- The team owns numerical solver validation and authoring tools.
- V1 does not receive WebGPU-specific performance or feature benefits.
- Direct Three.js requires internal lifecycle/component conventions.
- High-quality opponent animation remains a production discipline, not a library toggle.

## Evidence and remaining validation

The decision is backed by a working direct-Three.js adapter, WebGL 2 initialization in automated Chrome, adaptive pixel-ratio modes, renderer failure fallback, route-level code splitting, fixed-step trajectory tests, and 1920×1080 browser inspection. The code uses standard Three.js materials and no WebGL-only custom shader hooks, which keeps the later comparison bounded.

Public-release validation still requires the named Windows/Chrome and Edge hardware target, Firefox and Safari checks, a 30-minute mixed-session soak, a real large-display calibration review, and performance capture with the production opponent/environment assets. Those are release gates, not reasons to keep the implemented renderer choice ambiguous.
