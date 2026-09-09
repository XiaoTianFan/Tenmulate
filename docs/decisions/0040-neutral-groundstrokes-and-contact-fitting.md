# ADR-0040: Neutral groundstrokes and contact-aware flight fitting

- Status: Accepted for local implementation
- Date: 2026-09-09
- Supersedes: ADR-0030's search weights, spin floor and zone pace ceiling; the
  interval-filling return selection in ADR-0016. Retains physical integration,
  fixed sampled landing targets and explicit Exact/Lob behavior.

The default Natural groundstroke must consider neutral spin before increasing
launch pace. Search the requested pace across spin rates first. If a legal target
and the receiving contact can be reached with at most 1.7 m of net clearance,
retain that pace. Otherwise search pace and spin together, preferring about 1 m
above the tape over loft. These heights are product preferences, not tennis laws.
Explicit higher minimum clearance overrides them; the 3.5 m penalty remains soft.

Flat groundstrokes allow zero spin, with a 120 rpm default. Existing explicit
saved rates remain. Topspin/slice retain their axes and may reduce to 120 rpm
(or the lower requested rate). The model does not silently convert a topspin
drive into a backspin feed. Gravity, drag, lift, spin decay and bounce forces
are unchanged. The forward model is checked independently of the inverse search
against published trajectories and a separate RK4 calculation.

Natural zone fitting retains its normal 50–150% pace neighborhood. When that
cannot supply a low/deep, receivable ball, a bounded fallback can examine launch
speeds up to 110 km/h (or the existing 150% ceiling if higher). It is a fallback,
not the first solution. Actual resolved launch speed and spin remain visible;
there is no clock scaling or relabeling of launch speed as average flight speed.
Point-only fitting retains its previous bounded pace neighborhood. Exact keeps
the requested speed/spin and can still be physically unreachable.

The resolver accepts an optional receiving-contact predicate. It selects a
physical candidate satisfying that predicate before optimizing arc quality.
Practice uses the configured player's bounce phase. Player returns use the
opponent's bounce phase and, when needed, movement/preparation feasibility.
Drills also constrain the receiving camera's actual racket-reach envelope.
Predicates operate on integrated samples, including after the bounce; no source,
target, camera, contact phase, or flight duration is snapped to make a link work.

Quick Practice player returns and drill shots use the same court-direction
adapter and physics search. The rally planner cannot lower the requested return
pace a second time merely to fill an interval. It fits real intercepts and
motion rates; when an interval cannot coexist with the physical exchange, it
reports the actual interval. Legacy drills follow the same rule.

The tooltip identifies whose ball is selected and separates peak height above
the court, ball height at the net, and clearance above the local tape. Peak
height excludes subsequent bounces. Both displayed paths keep their own metrics.

The solver identifier is `ball-v9-neutral-contact-fit`; planner identifiers are
`gameplay-return-shots-v11` and `gameplay-player-drills-v12`. No content schema,
saved coordinates, opponent hand or motion assets change.
