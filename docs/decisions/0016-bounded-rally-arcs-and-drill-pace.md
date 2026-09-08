# ADR-0016: Bounded rally arcs and fixed-speed drill feeds

- Status: Accepted for local implementation
- Date: 2026-09-08
- Supersedes: The natural drill baseline and return-arc selection in ADR-0015.

Visual verification of ADR-0015 showed that a full recovery detour could make the
solver choose excessively high return arcs. The legacy target solver could also
raise the actual outgoing drill speed above its authored setting.

The natural drill baseline now uses the minimum feasible direct movement route
and ball travel time. Recovery is selected only when its full detour fits the
available interval. Quick Practice still budgets its fixed-home route.

Compiled drill feeds use fixed-speed angle resolution, retaining the selected
launch speed. Return trajectories must also fit an apex ceiling: 6 m for ordinary
shots, 4.5 m for volley feeds and 10 m for overhead lob feeds. The 0.65–1.35 speed
ratio and 2.5 cm contact tolerance apply together with net and bounce checks.
A link for which no valid solution is found begins a new feed.

This is an authored rehearsal calibration. It preserves the original shot and
movement constraints and does not claim that the bounded search is an exhaustive
model of human tennis.
