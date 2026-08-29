# ADR-0001: Web rendering and simulation architecture

- **Status:** Proposed
- **Date:** 2026-08-29
- **Decision owners:** Project owner and implementation lead

## Context

The product needs a first-person 3D court, animated opponent, high-speed tennis ball with spin and bounce, deterministic drill timelines, large-screen performance, and a future path to body tracking. WebGPU is attractive but still uneven across devices, and Three.js documents important differences between its mature WebGL renderer and experimental WebGPU renderer. Generic rigid-body physics does not directly solve authored tennis trajectories.

## Proposed decision

1. Use React, TypeScript, and Vite for the application shell.
2. Integrate Three.js directly behind an engine adapter whose interface is independent of React.
3. Begin the vertical slice with Three.js `WebGPURenderer`, staying within its WebGPU/WebGL 2 shared material path.
4. Maintain a benchmark comparison with forced WebGL 2 and, if practical, `WebGLRenderer` before accepting the renderer decision.
5. Implement the tennis ball as a custom fixed-step 3D numerical model with gravity, drag, Magnus lift, exact court/net events, and calibrated bounce response.
6. Use Rapier only if later collision-heavy features justify a general physics world.
7. Use code-generated parametric court primitives plus Blender-validated GLB for skinned opponents and complex assets, with explicit animation contact, handedness, and serve-rhythm metadata. The source generator/model remains open until ADR-0003's bake-off.
8. Keep camera-based player tracking behind a future worker-isolated adapter and out of V1; it is the defining V2 boundary.

## Rationale

- Three.js directly matches the requested stack and offers a compact code-first runtime.
- `WebGPURenderer` supplies an automatic WebGL 2 backend, but the project can accept it only after the real vertical slice is tested.
- React remains useful for product UI without becoming the simulation clock.
- A tennis-specific solver can be validated against published equations, ITF bounds, landing targets, and expert perception.
- GLB is the best-supported runtime delivery format across Blender and Three.js for skinned/animated assets.
- Deferring body tracking protects V1 performance, privacy, and scope.

## Alternatives considered

### Three.js `WebGLRenderer` as the only renderer

Lower short-term uncertainty, but it encourages WebGL-specific shader/postprocessing investments and postpones the WebGPU transition. It remains the preferred fallback if the spike exposes unacceptable WebGPU-renderer gaps.

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
- Supporting the shared WebGPU/WebGL path constrains shader/material choices.
- Direct Three.js requires internal lifecycle/component conventions.
- High-quality opponent animation remains a production discipline, not a library toggle.

## Acceptance evidence required

This ADR moves to **Accepted** only when the vertical slice records:

- initialization and fallback results on the target browser/device matrix;
- CPU/GPU frame-time percentiles at 1080p and the target large-screen configuration;
- visual comparison across renderer paths;
- a validated forehand trajectory with net, bounce, and receiver-plane metrics;
- frame-step and normal-speed contact synchronization evidence;
- physical-view versus immersive FOV review on a real target display;
- a documented list of unsupported or intentionally avoided renderer features.

If any gate fails, write a replacement ADR rather than silently changing the implementation.
