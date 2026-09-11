# ADR-0047: Automatic opponent stroke choice and contact-sized footwork

- **Status:** Accepted for local implementation
- **Date:** 2026-09-11
- **Scope:** Quick Practice, player-first drills and their previews
- **Supersedes:** Forced alternating sides and mandatory practice sidesteps in ADR-0015/0016; extends ADR-0032/0033/0044

## Context

Quick Practice chose forehand/backhand from the repetition index. A fixed side
could send the body around a nearby return unnecessarily. Independent feeds also
added a 0.7–0.9 m sidestep even without an incoming ball. Reactive approaches were
stretched across their entire available window, producing slow travel despite a
high movement preference. Small forward/backward adjustments could select a
turning walking/jogging loop instead of tennis footwork.

## Decision

Introduce `StrokeChoice = auto | forehand | backhand` for opponent configuration.
Player-authored shot identity remains forehand/backhand. Replace Quick Practice's
Alternate sides option with Automatic; load legacy `alternate` as `auto`, retaining
explicit fixed choices. Unmodified built-in shot/drill responses default to auto.
Do not overwrite custom presets, existing timeline copies or unfinished edits.

Both compilers use `resolveOpponentStroke`. At a candidate physical incoming
contact, derive both rigid racket anchors, body roots and prepared entries. Check
their feasibility with the shared recovery planner at the physical rate ceiling,
then rank feasible sides by travel, detour, duration and a small switching cost.
The ball contact position/time is immutable: move the mannequin, not the ball.
Resolve once during compilation, with deterministic ties; never flip sides per
frame. A standalone opening feed has no incoming side to read and defaults to
forehand at its configured root. Explicit side choices remain binding.

Treat neutral recovery as an area. Already-balanced roots within 1.25 m of the
computed neutral mark stay there, blending toward full recovery by 1.8 m. Retain
partial recovery, reaction cue, split-step and continuing approaches from ADR-0044.
Spend spare receiving time ready before the final approach, whose duration follows
the movement preference and ends at prepared stroke entry. Independent feeds stay
at the configured root instead of manufacturing sidesteps.

Use the same distance-clock footwork in both modes: small corrections in any
direction use adjustment clips and finite foot placements; moderate lateral
travel can start with an anatomical front/back crossover; urgent/long travel uses
the running layer. Distance, speed, acceleration and source cadence jointly select
the gait. Heading turns fade out for small, unhurried corrections. Preserve the
existing authored clips, rigid grips, fixed bone lengths, prepared-entry blending,
speed/acceleration ceilings and active source-rate budgets.

## Consequences and verification

There are at most two side candidates per contact, evaluated outside frame
rendering. No new animation assets or trajectory physics changes are introduced.
Sliding remains an explicit authored movement rather than an automatic hard-court
default. Selection thresholds are product calibrations, not measured universal
tennis rules. Existing motion-family proxies remain in use.

Planner versions: `gameplay-opponent-footwork-v13` and
`gameplay-player-drills-v16`. See the [implementation and rendered receipt](../development/opponent-footwork-2026-09-11.md).
