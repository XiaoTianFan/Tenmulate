# ADR-0051: Quick Practice returns and starting views

- Status: Accepted for local implementation
- Date: 2026-09-12
- Supersedes ADR-0039's Quick Practice player-return controls and feed-only presentation for Return, Volley and Overhead.

## Decision

Each Quick Practice mode displays an animated player response. Rally retains its
physical connection to the next opponent contact. Return, Volley and Overhead
remain independent feeds at the configured rhythm; their responses do not create
another opponent hit. The player response is a groundstroke for Rally/Return,
an airborne volley for Volley, and an airborne descending overhead for Overhead.

The shared blue landing zone is the only player-return setting in Practice.
Existing stored zones remain editable in every mode, independently of the
incoming trajectory toggle. Player shot/spin/pace/timing controls are removed
from Practice, and hidden legacy player settings do not drive the UI's sessions.
Drill authoring keeps its existing controls. Incoming ball configuration and
Quick Rally's opponent-contact preference remain available.

An independent response begins at a real sample on the incoming flight. Contact
selection prefers the player's position and the camera-relative volley/overhead
height, then solves a legal outgoing flight into a seeded point in the blue zone.
It ends at the second bounce. Rest and final session completion include that
response. The continuous preview preserves responses across batch boundaries.
Very short independent-feed intervals can overlap balls; their feed cadence is
not extended to wait for a completed player response. Configurations without a
legal contact/flight remain incoming feeds rather than inventing a contact.

The renderer binds Quick Practice trajectory geometry to incoming flights only.
It excludes player preview lines, return hover trajectories and player trails,
including when top-down inspection or playback diagnostics enable trajectories.
The animated player ball remains visible. Drill trajectory presentation is unchanged.

Selecting Overhead defaults the opponent's body root to (0.1, 9.8) m, with the
camera at the service-line T, 6.4 m behind the net, 1.7 m eye height and +18 degree
pitch. A deterministic look adjustment follows the incoming lob, eases in over
0.6 s and releases over 0.8 s after contact. Focus stays at least 0.75 m ahead of
the authored viewing direction, avoiding a 180-degree spin when the ball passes
overhead. Pitch is capped at 65 degrees. Position and FOV remain authored;
top-down editing suspends this look adjustment.

Selecting Volley defaults the camera to 3.2 m behind the net, halfway between
the T and net, at 1.7 m eye height and -2 degree pitch. Reset view restores the
mode's starting position/direction. Existing camera presets remain independent;
saved user adjustments still survive reload. Camera angle/FOV edits do not
recompile ball physics; position and eye-height edits do.

The opponent-feed planner version becomes `gameplay-opponent-footwork-v15`.
Physics and player-drill versions remain `ball-v11-net-shots` and
`gameplay-player-drills-v20`. No motion assets or project catalogs are changed.

## Verification

- 627 tests in 59 files pass, including physical contact continuity, both hands,
  return family/zone, preview seams, finite completion and 240 Hz overhead-camera continuity.
- Production build and active-motion/precache verification pass. The large
  serial/worker/rewind preview comparison now allows 10 s for its added player
  flights; all existing equivalence and cache assertions remain.
- Playwright/Edge checked the actual UI defaults and dragged the blue zone in
  all four modes, with zero player-return input/select controls remaining.
- Eight rendered sessions (four modes in both hands), 384 sampled frames,
  exercised incoming trajectories on/off and overview on/off. Player balls
  appeared after contact; no player trajectory, hover path or trail appeared.
  Overhead contact-window yaw stayed within 28 degrees instead of turning around.
- Overhead was also launched through the real Practice UI and displayed its
  player-return phase with the T-position camera.

Artifacts: `C:/Users/20378/.codex/visualizations/2026/09/12/01a09414-f625-7dd2-ba82-d570264839e1/quick-practice/`.
Local implementation and browser verification only; owner acceptance and public
deployment remain separate.
