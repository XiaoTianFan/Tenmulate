# Return shot controls — 2026-09-09

Contract: [ADR-0036](../decisions/0036-independent-return-shot-and-spin.md).

## Physics and data

Independent return type/spin/rate is carried through validation, JSON exchange,
saved preset snapshots, seeded zone resolution and the shared rally planner.
Return style owns contact eligibility and preferred physics parameters. The next
opponent remains a physical intercept of that flight, with the outgoing shot
resolved at the same point and clock. Drop shots have an incoming family/profile
and library default. Volleys now apply selected spin. Serve-only kick/sidespin
choices normalize safely in older non-serve records.

The automated suite covers actual bounce targets, distinct spin trajectories,
incoming-flight independence, contact eligibility, serve-volley rejection,
determinism, legacy normalization, preset/JSON persistence and invalid fields.
Both-hand drop-shot landing variation is included in the existing zone tests.

## Authoring and browser verification

Flow: Editor → choose return type/spin → move its top-down zone → save/update
preset → reload/reuse → Test drill; Quick Practice → select incoming type/spin.

Browser plugin was unavailable; existing Playwright drove isolated headless Edge
against the production preview at `http://127.0.0.1:5173/`. Desktop 1680×1080 and
mobile 390×844 checks pass for:

- Page identity, meaningful content, no framework overlay or runtime errors.
- Separate Opponent shot, Return zone, and Ball & rhythm controls.
- Return groundstroke/topspin/flat/slice and drop/overhead/volley choices.
- Serve-only kick/sidespin in both editor and Quick Practice; switching away
  from Serve removes the stale selection. Volley labels remain distinct.
- Opponent-side zone dragging retains return spin and performs no compilation
  while held. Incoming type changes retain return type/spin and zone.
- New preset save, overwrite of the same id, and reload/reuse preserve return
  configuration and the moved zone. Mobile has no horizontal page overflow.

## Rendered gameplay

An isolated Vite page at port 4181 used the actual `TennisScene` and active
mannequin. Both playing hands were sampled at approach, swing and contact for
topspin/flat/slice ground returns, drop/volley/overhead returns, and the opponent's
drop/volley/overhead strokes (54 frame checks). Every accepted handoff is exact;
maximum rendered racket contact error is 0.00000114 m, and maximum non-root
bone-length change is 0.00000019 m. Contact frames and the drop approach/swing
frames were visually inspected. Motion assets, source clocks and rigid grips
remain unchanged.

The representative cases link at 3.5 seconds for ground/drop returns, 2.5 seconds
for the volley return, and 3 seconds for the overhead return. QA selected a
feasible interval per case; arbitrary authored combinations are not guaranteed
to link. The app displays the new-feed status when they cannot. Existing camera
and recovery feasibility constraints remain in force.

Evidence is outside the repository:
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/return-shot-controls/`.
Scripts: `controls-qa.mjs`, `rig-qa.mjs`; measurements: `rig-results.json`.
UI captures: `editor-return-controls.png`, `editor-return-mobile.png`,
`practice-shot-controls.png`, `drill-return-playback.png`. Both-hand contact
captures use `{hand}-{case}-{stage}.png`.

Final checks: all **384 tests across 40 files**, `npm run build` and
`npm run check:motion` pass. The production build retains the existing large-chunk
advisory. The physics/data stage is committed as `c23ddf9`; the UI and verification
receipt are a separate focused local commit. Verification used
isolated browser storage; the owner's open editor was not reloaded. Local
verification does not imply public deployment or physical-player validation.
