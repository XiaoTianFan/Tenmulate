# Player handedness mirroring — 2026-09-09

The Drill library and Editor expose the same **Player handedness** choice. Selecting
Left-handed reflects the whole drill layout around the court centerline; selecting
Right-handed restores its right-hand orientation. Names such as “Forehand crosscourt
deep” retain their identity. The opponent keeps their authored hand.

`src/content/playerHandedness.ts` owns the pure coordinate transform. Both landing
zones, all cameras and opening positions use the same transform. Bounds stay ordered,
zero stays JSON-safe and same-hand selection is idempotent. Camera yaw reflects;
pitch, depth, height and field of view are preserved. No venue geometry, canvas
scale or renderer mounting changes are involved.

The shared browser preference is separate from Quick Practice. Each saved drill
and shot records its coordinate orientation in optional schema 2 `playerHand`;
older records default to right-handed layouts. New/default and saved shots adapt
to the editor's hand on insertion. Saved-shot overwrite updates that orientation.
Imports adapt once; exported coordinates already match the selected hand. Undo and
redo also restore the shared preference. Existing per-shot player-hand overrides
are replaced by the selected drill-wide hand when the layout is applied.

The planner mirrors the seeded horizontal landing quantile while leaving depth,
speed and spin draws unchanged. Uniform target coverage is preserved. The opponent
still uses their own racket hand and serve spin, so the planner refits physical
contacts and timing rather than reflecting a solved animation. An opening at the
center mark retains the chosen service box when mirrored and edited.

## Verification

- `npm test`: 451 tests across 44 files pass. The 23 new checks cover all 21 shot
  presets, all 16 drills, headings, contact anchors, inverse/idempotent transforms,
  unchanged opponent hands, seeded samples, JSON, saved orientation, shared
  preference and older records. Each bundled drill completes two left-handed sets
  using the application seed, with continuous ball contacts and no planning issues.
- `npm run build`: TypeScript, production bundles, PWA and active motion/cache
  guard pass. The existing large-chunk advisory remains. No motion assets changed.
- Actual Three.js probes cover 72 approach, prepared-entry and contact frames in
  four left-handed player scenarios with each opponent hand, plus camera views
  and tracking between shots. Rigid-bone and racket-contact assertions pass.
- Production Edge passes 22 UI checks at 1680×1000 and 390×844, including the
  projected court mirror, stable names/opponent hands, shared setting, Undo/Redo,
  default and saved-shot insertion, overwrite, import, reload and gameplay.
  Desktop/mobile screenshots were inspected. No runtime errors or narrow-page
  horizontal overflow were observed. Browser plugin unavailable; isolated
  Playwright contexts used the existing local build.

Browser evidence is recorded in the [visual verification ledger](visual-verification.md#player-handedness-mirroring--2026-09-09).
Scripts, JSON measurements and screenshots live outside the repository at
`C:/Users/20378/.codex/visualizations/2026/09/08/01a07e7c-7199-7900-ab83-f0437137320b/player-handedness/`.
The original app tab and its unsaved state were left untouched. Exact timings can
differ between player hands because the opponent hand is preserved. Custom
combinations still pass through the existing reachability checks; these bounded
tests do not certify every possible custom drill or random seed.
