# ADR-0049: Camera-relative net-shot planning

- Status: Accepted for local implementation
- Date: 2026-09-12
- Extends: ADR-0037 and ADR-0048 with camera-relative preferred volley contact height

## Problem

Isolated player volleys used a fixed 1.3 m source regardless of eye height.
Half-volleys shared the natural groundstroke arc preference, and their default
one-metre net clearance added unnecessary lift. Natural volleys tolerated an
18-degree launch before trying a wider pace range. Deep net shots consequently
looked like looping groundstrokes. Changing only contact height did not solve it.

## Decision

Use a preferred player volley contact at eye height minus 0.10 m, bounded to
0.65–2.05 m. Half-volleys prefer eye height minus 1.20 m, bounded to 0.25–0.80 m.
These offsets are product calibration, not measured player anatomy. Isolated
previews use that anchor. Full sequences prefer nearby real incoming contacts and
try a legal feed within 0.15 m of the preferred height. If that height cannot be
reached, retain the playable feed and its actual contact. Never relocate the ball
or violate the airborne volley / rising half-volley constraint. Camera yaw, tilt,
eye height and FOV remain authored; contact footwork still resolves in x/z.

Both court halves share the bounded natural speed/spin solver, with a separate
net-shot arc cost. Prefer low net clearance and little upward launch on high
volleys. Account for the straight source-to-target geometry so high contacts do
not demand needless extra speed to chase an impossible low clearance. Low
volleys and half-volleys retain the upward component needed to clear the net.
Targets, wind and aerodynamic time remain physical; Exact mode and explicitly
authored higher clearance retain their meaning.

Opponent volleys prefer a 1.50 m contact within their existing motion envelope;
opponent half-volleys use 0.65 m as their nominal contact. Actual rally contacts
still come from the player's incoming ball. New volley presets use 60 km/h and
0.12 m minimum clearance; new half-volley presets use 0.12 m clearance. Saved
catalog settings are not overwritten.

If a flatter player net shot cannot connect the next return/camera movement,
repeat the bounded flight search with the complete next link as its acceptance
condition. Select a physically playable trajectory rather than retiming a ball,
accelerating movement without limits, or silently ending the point.

## Basis and verification

The [USTA volley guide](https://www.usta.com/en/home/improve/tips-and-instruction/national/learning-the-basics--volleys.html)
distinguishes firm put-away volleys from softened drop volleys; it does not imply
one launch direction at every contact height. Net clearance and the forward
flight model determine whether a downward shot is physically possible here.

Regression tests cover high/low contacts, both court directions, exact settings,
camera-height changes, real incoming handoffs, defaults and every shipped drill.
Rendered evidence and numerical before/after comparisons are recorded in the
[implementation ledger](../development/implementation-status.md).
