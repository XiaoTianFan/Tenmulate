# ADR-0008: ITF-runoff opponent positioning

- **Status:** Accepted
- **Date:** 2026-08-31

## Context

The opponent floor plan previously mapped only the 10.97 × 23.77 m marked doubles court. That excluded normal defensive and recovery positions beyond the sidelines and baselines. It also placed the default Rally opponent 0.65 m inside the far baseline, which represented an aggressive court position rather than a neutral rally origin.

The [2026 ITF technical booklet](https://www.itftennis.com/media/15648/2026-technical-booklet.pdf), Table 5 on pages 43–44, recommends at least 6.40 m between each baseline and backstop and 3.66 m between each doubles sideline and sidestop for international competition. These are facility clearances, not mandated player positions, but they define the appropriate professional-scale floor envelope for authoring opponent movement.

## Decision

1. Use the symmetric international-competition envelope for opponent placement: `x = ±(5.485 + 3.66) = ±9.145 m` and `z = ±(11.885 + 6.40) = ±18.285 m`.
2. Render that envelope to scale around the regulation court in both Quick Practice and the drill editor. The marked court remains visually distinct and the runoff labels state the two ITF clearances.
3. Default Groundstroke/Rally positioning and the three baseline presets to 1.0 m behind the far baseline (`z = 12.885 m`). Serve, volley, service-line, and net positions retain their shot-specific origins.
4. Migrate only the exact former Rally default `(0, 11.235)` to the new origin. Preserve other saved positions and clamp malformed/out-of-envelope preferences to the new boundary.
5. Validate imported event positions against the same shared bounds. Court geometry, landing legality, and shot coordinates remain independent; an unreachable extreme source may still resolve to the solver's explicitly reported closest physical result.

## Verification contract

- Tests assert the ITF-derived bounds, default runback, boundary clamping, legacy migration, accepted runoff event positions, rejected out-of-envelope positions, and legal target-practice trajectories from the new default.
- Browser review confirms the expanded runoff is visible, the baseline preset sits behind the line, dragging reaches side and back runoff, coordinates persist after pointer release, and the rendered opponent follows the selected source without console errors.
