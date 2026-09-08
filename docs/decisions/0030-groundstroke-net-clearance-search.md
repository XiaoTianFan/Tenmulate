# ADR-0030: Groundstroke search by net clearance

- Status: Accepted for local implementation
- Date: 2026-09-08
- Supersedes: Groundstroke speed-first search and 22-degree comfort proxy in ADR-0017; retains the landing-zone intent and pace envelope in ADR-0018.

Natural groundstrokes select launch elevation, speed and spin together. A legal
net crossing and the same sampled first-bounce target take priority. Among
attainable candidates, prefer less height above the net tape, with a steep,
finite penalty above **3.5 m clearance**. This is not a cap on apex height or a
clamp on the rendered path. If the bounded parameters cannot produce a lower
arc, a valid higher ball remains preferable to a fabricated target hit.

The search balances clearance against deviations from requested pace and spin.
It can reduce groundstroke spin by up to 75% or raise it by up to 20%. The lower
spin bound is 250 rpm unless the requested topspin/slice rate is already lower;
the existing flat-stroke 250–1600 rpm calibration remains. Spin kind/axis is not
silently changed. Zone pace remains bounded to ±50%; point-only callers retain
±15%. The existing 28.8 km/h integration floor remains. These bounds and objective
weights are product preferences, not universal tennis laws.

Search the joint speed/spin neighborhood, expanding the zone pace search when
the target is missed **or clearance remains excessive**, then refine locally.
Cache equivalent parameter candidates. First-flight probes reuse state vectors
and share exactly the same force function with final integration. Sampled flight,
bounce and receiver data are generated only for the chosen candidate.

Groundstrokes retain the lower range branch. Explicit minimum clearances above
3.5 m are respected. Exact mode preserves speed/spin and Lob retains its high
branch. Other shot families retain their existing parameter-selection policy.
Gravity, aerodynamic coefficients, spin axes/decay, wind and bounce response are
unchanged. Failed targets remain visibly unreachable, with no target resampling
or bias in landing-zone sampling.

The compiler reports `ball-v7-net-clearance`. Practice, the editor and drill
playback all use this resolver. Resolved speed/rpm stay visible; the old universal
20% spin-adjustment explanation is removed.

See the [research and verification receipt](../development/groundstroke-net-clearance-2026-09-08.md).
