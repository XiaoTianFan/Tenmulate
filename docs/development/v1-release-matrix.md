# V1 release matrix

- **Snapshot:** 2026-08-30
- **Scope:** Local public-free V1 with canonical scenes and a neutral mocap carrier
- **Authority:** [Product requirements](../product-requirements.md)

Status meanings:

- **Implemented:** code exists and has automated and/or browser evidence.
- **Implemented; external validation:** code is present, but named release-device or human review is still required.
- **Production asset pending:** the typed runtime/content seam exists, but the user-authorized procedural substitute is still active.
- **Conditional:** the feature must stay absent until its stated capability gate passes.

## Calibration and point of view

| ID | Status | Evidence or remaining gate |
| --- | --- | --- |
| CAL-01 | Implemented | Width, height, and viewing distance report horizontal/vertical FOV; a 27° physical FOV was applied in browser. |
| CAL-02 | Implemented | Six independent camera axes update only the scene camera. |
| CAL-03 | Implemented | Realistic preset/reset restores 1.70 m eye height, centered 1.5 m runback, level gaze, and 70° horizontal FOV. |
| CAL-04 | Implemented | Named views save, apply, rename, and delete in local versioned storage. |
| CAL-05 | Implemented; external validation | The calibration dialog exposes regulation court/net/ball checks; real TV/projector review is pending. |
| CAL-06 | Implemented | First practice launch is gated by a local safe-space acknowledgement with no room-measurement claim. |
| POV-01 | Implemented | SI constants and court-construction tests cover 8.23 × 23.77 m singles geometry, 6.40 m service distance, net center/posts, and ball radius. |
| POV-02 | Implemented | Separate court-appearance and bounce-profile state; clay appearance with grass physics passed browser inspection. |
| POV-03 | Implemented | The near-player layer is absent by design. |
| POV-04 | Implemented | Browser fullscreen plus button/H-key HUD hiding; central transport remains available. |
| POV-05 | Implemented | Camera presentation lives on launch/event metadata and never enters trajectory resolution. |
| POV-06 | Implemented; owner visual approval pending | Six distinct code-owned Three.js venues render around the same exact court. Outdoor Panel 1 is the fidelity baseline; final owner/device review remains. |
| POV-07 | Implemented | Venue-specific light presets, direction, and intensity alter only scene presentation. |
| POV-08 | Implemented; external visual validation active | Exact court/ball coordinates and all venue geometry, materials, props, and lights remain code-owned. No generated-world registration or proxy layer is permitted; final target-display review remains. |

## Ball simulation

| ID | Status | Evidence or remaining gate |
| --- | --- | --- |
| BALL-01 | Implemented; external calibration | Fixed 240 Hz gravity, quadratic drag, Magnus coupling, and five spin modes are tested across all bundled shots. Physics tuning against measured/player evidence remains. |
| BALL-02 | Implemented | Hard/clay/grass restitution, retention, and spin coupling are separate from flight; bounce events report pre/post speed. |
| BALL-03 | Implemented | Shots author source, landing target/depth, pace, spin, net clearance, and receiver plane; launch vectors are solved internally. |
| BALL-04 | Implemented | Fixed-step simulation is independent of render refresh and records the first net, bounce, and receiver crossing. Multi-refresh device evidence remains part of the browser matrix. |
| BALL-05 | Implemented | High-contrast scale/material and short trail are renderer-only; diagnostic centroid samples remain unchanged. |
| BALL-06 | Implemented | Every bundled shot must cross the net and land in bounds in the content-wide test; imported targets/clearance/enums are bounded and invalid content is rejected. |

## Opponent and serve motion

| ID | Status | Evidence or remaining gate |
| --- | --- | --- |
| OPP-01 | Carrier implemented; tennis motion pending | CC0 741 kB neutral GLB, 65-joint skin, 23-role adapter, ready pose, lazy animation loader, and failure fallback run in-browser. Mocap/deformation review remains. |
| OPP-02 | Runtime boundary implemented; production asset pending | Deterministic contact/launch boundary and clip playback seam exist; separate racket plus contact markers require the selected mocap clips. |
| OPP-03 | Runtime boundary implemented; production asset pending | Camera/ball sequence metadata and animation mixer exist; opponent footwork/root-motion review requires owner-supplied clips. |
| OPP-04 | Metadata implemented; production asset pending | Every compiled shot accepts left/right opponent metadata and both hand sockets exist; visual mirror/distinct-clip review remains. |
| OPP-05 | Trajectory/rhythm implemented; production asset pending | Eight legal serve trajectories span both hands and independent normal/compact metadata; distinct serve-motion timing remains. |
| OPP-06 | Schema/runtime seam implemented; production asset pending | Serve rhythm is independent of pace in schema/editor/compiler; readable preparation and playback bounds require animation review. |

## Drills and local content

| ID | Status | Evidence or remaining gate |
| --- | --- | --- |
| DRILL-01 | Implemented | Repetition, interval, seeded timing variance, work/rest, pause, restart, and cached local playback are exercised. |
| DRILL-02 | Implemented | Compiled repetitions coordinate ball, camera, cue, and rest state on one deterministic clock; opponent metadata occupies the same event. |
| DRILL-03 | Implemented | Exact seed replay and bounded shot/timing variation have automated coverage. |
| DRILL-04 | Implemented | 26 shots and 16 drills cover every named family and requested tactical sequence. |
| DRILL-05 | Implemented | Learning exposes predictive cue/trajectory and slow motion; rehearsal removes predictive overlays. |
| DRILL-06 | Implemented for code-owned primitives; asset validation pending | Five-track editor, undo/redo, live preview, bounded nested camera validation, and test play exist. Clip/GLB availability checks start with production assets. |
| DRILL-07 | Implemented | Size-limited schema-v1 JSON exchange allowlists fields and rejects duplicate IDs, remote URLs, invalid geometry, unknown primitives, and malformed JSON. |
| DRILL-08 | Implemented for current bundled/local content | Production service worker hard-reloaded offline after network removal. Optional production asset caching/errors remain an asset-stage gate. |

## Camera movement

| ID | Status | Evidence or remaining gate |
| --- | --- | --- |
| CAM-01 | Implemented | Typed paths carry position/orientation, delay, duration, bounded values, and smoothstep easing outside ball simulation. |
| CAM-02 | Implemented | Bundled lateral baseline, approach, first/second volley, retreat/lob, and overhead paths plus matching camera presets are present. |
| CAM-03 | Implemented; human comfort review pending | Conservative durations, smoothstep interpolation, zero head bob, and `prefers-reduced-motion` suppression exist. |
| CAM-04 | Implemented | Live 0–100% camera-motion scaling can disable authored movement without recompiling shots. |

## Non-functional and public-release gates

| Gate | Current evidence | Required before claiming public release |
| --- | --- | --- |
| Functional code | Automated unit/content/storage/import tests plus 1920, 1280, and 820 px browser flows | Keep the suite green at the release commit. |
| Performance | Actual FPS/frame-time/pixel-ratio telemetry and adaptive modes; route and Three.js chunks are split | Profile named mid-tier 1080p and intended 4K hardware with production assets. |
| High refresh | No 90/120 option is exposed | Expose only after capability detection and a short local benchmark pass. |
| Long-session stability | Deterministic clock and disposal paths are implemented | Complete a measured 30-minute mixed-session soak with memory/frame-time evidence. |
| Browser coverage | Automated Chrome/WebGL 2 pass with zero errors/warnings | Validate current Chrome/Edge on Windows, Firefox on Windows, and Safari on macOS. |
| Large-display fit | Physical FOV calculation and responsive setup are implemented | Observe real TV/projector scale, comfort, ball readability, and safe-space workflow. |
| Human usefulness | No technique or medical claims are made | Owner, one coach, and at least three other target players across levels complete observed sessions. |
| Production visual layer | Six authored Three.js venues and the CC0 neutral opponent carrier render in-browser; source/runtime hashes and fallback are recorded | Complete owner visual approval, import the racket and accepted mocap, then pass contact, deformation, handedness, depth, lighting, load, and provenance reviews. |
| Accessibility/privacy/legal | Keyboard, reduced motion, mute/levels, visual cues, contrast ball, safety acknowledgement, and no camera request exist | Complete formal accessibility, privacy text, license/provenance, and public legal review. |
| Hosting/operations | Production PWA build and offline shell pass locally | Validate public origin/CDN headers, immutable asset paths, monitoring, release notes, and rollback runbook. |

V2 camera capture/body tracking and later freemium accounts/payments are intentionally outside this matrix.
