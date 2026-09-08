# ADR-0027: Ball-only highlight with direct scene rendering

- Status: Accepted for local implementation
- Date: 2026-09-08
- Supersedes: ADR-0023/0024's focus renderer and ADR-0025/0026's blur behavior.
  The shared optional preference and approaching-ball highlight remain.

## Decision

The owner rejected blur and requested highlighting only the ball, excluding the
trajectory and landing zone. Delete the ball-focus compositor, depth/blur shaders,
render targets, focal-distance interpolation and Maximum blur control. There is
no dormant blur mode. Every frame renders the scene directly after updating only
ball material color and emissive intensity. No bloom or screen-space highlight
is applied to the world, trajectory, trail, landing-zone fill/outline or grips.

Rename the Perspective control to **Ball highlight** in Practice, Editor and drill
playback. Retain the persisted `ballFocus.enabled` key to preserve the user's choice;
normalization drops obsolete `maxBlurPx` values and subsequent saves remove them.
The toggle remains off for new profiles. Highlight retains the existing exponential
after-net approach and visible-frame gating. No gameplay clock or motion changes.

## Local verification

- **315 tests / 31 files** and production/PWA build pass. Three tests exclusively
  covering the deleted lens renderer were removed. Migration tests verify that
  the toggle survives and old blur values disappear from saved preferences.
- Six real Chrome/WebGL image comparisons cover three approach distances and
  standard/high-contrast balls. All changed pixels are within the ball's bounds;
  every other material is identical. With balls hidden, enabled/disabled full-frame
  images are pixel-identical. Trajectory and landing zone are visible in the test.
- Enabled/disabled draw calls and texture counts match, with no GL/browser errors.
  The renderer bundle decreases from 688.51 kB to 675.77 kB before gzip.
- Production UI tests cover Practice, Editor, drill playback, 390 px layout,
  keyboard operation, reload, old preference migration and absence of blur controls.
  Toggling preserves scene instance and session revision.

The Browser plugin was unavailable; existing regular Playwright checked the source
renderer on a temporary 4186 harness and the production UI on 5173. Local artifacts:
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/ball-highlight/`.
Reproduction scripts are `../ball-highlight-qa.mjs` and `../ball-highlight-ui.mjs`.
The temporary harness was stopped and the user's in-app preview refreshed. This
records local implementation and verification, with no public deployment.
