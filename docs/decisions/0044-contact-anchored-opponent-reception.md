# ADR-0044: Contact-anchored opponent reception

- **Status:** Accepted for local implementation
- **Date:** 2026-09-10
- **Scope:** Connected Quick Rally returns and player-first drill responses

## Context

The bounce-contact selector already filters rising, apex and descending contacts.
However, the shared movement planner only knew the two opponent stroke clocks. It
could use time before the player's return to approach the next intercept slowly,
without reacting to the player's actual contact. A long requested interval did
not provide extra time once the two physical flights fixed the next intercept.

## Decision

Carry an `IncomingContact` record from physical contact selection into feasibility,
rate solving and playback. It contains absolute player release, bounce, apex and
opponent contact times, plus the selected physical phase. Compute the apex before
trimming the incoming flight at contact.

Use the same `planRecovery` implementation for scheduling and animation. For an
ordinary reception, recover toward neutral only as far as both movement windows
allow, split around the player's contact, then approach the selected intercept.
The receiving split lasts 0.22 seconds and ends 0.10 seconds after the release cue,
or later if the previous stroke has not finished. These are simulation tuning
values, not claims about measured human reaction times. Preserve the partial
recovery heading through the split and arrive at the prepared stroke entry.

Determine whether this reactive route is possible at the physical motion ceiling
before optimizing preferred stroke and movement rates. Slow preferences must not
avoid acceleration by selecting an anticipatory route. If even the ceiling cannot
fit a reactive route, allow a continuing direct approach, explicitly recorded as
`reception: 'continue'`. This preserves reachable wide/short exchanges without
changing the contact phase or manufacturing extra flight time. Reject a final
motion budget that exceeds the immutable physical intercept.

This replaces gap-only recovery planning for connected returns under ADR-0015 and
ADR-0016. Independent feed recovery retains its existing behavior. The physical
phase and unscaled ball-clock decisions in ADR-0040 remain in force: requested shot
interval is a fitting preference, and the interface reports the actual physical
interval when the flights cannot satisfy it. Do not pause a live ball or turn it
into a lob merely to fill that interval.

## Consequences and verification

The selected contact is the scheduling anchor; movement and stroke rates adapt
around it. Source clip clocks, rigid grips, prepared entries, contact anchors,
handedness, trajectory physics and saved settings retain their contracts. No
motion asset or content schema changes.

Planner versions are `gameplay-return-shots-v12` and
`gameplay-player-drills-v15`. See the [implementation and rendered verification
receipt](../development/rally-contact-reception-2026-09-10.md) for automated and
actual post-IK gameplay evidence. Local verification is distinct from owner
acceptance and public deployment.
