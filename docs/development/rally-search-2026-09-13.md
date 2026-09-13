# Rally variation stall investigation

The reported project Rally setup is captured as an immutable regression fixture
in `tests/rally-search.test.ts`. It uses 70 km/h, 8% variation, 3.5 s requested
intervals, a roughly 9.93 m incoming landing depth, a 9.02–11.02 m blue zone and
bounce factor 1.05. Before the fix, preview cycle 2 failed at repetition 15
(the sixteenth shot) with the reported warning.

The old search tried only two player contacts for one sampled return target.
It checked opponent movement before accepting a contact but resolved the
opponent's next outgoing ball afterward. This confused a rejected local choice
with an unusable zone configuration and allowed poor choices into later batches.

[ADR-0054](../decisions/0054-rally-feasibility-before-variation.md) defines the
updated prerequisites, constraint precedence and numerical search limits.
The compiler now keeps searching within the zones and verifies the outgoing
flight and shared timing solver before accepting an intercept. Automatic player
shot defaults can yield to another supported response; authored choices remain.

## Verification

- The captured setup completes 12 continued randomized batches (78 shots total),
  with no planning issues. Tests assert both flights land in their zones, exact
  contact/source and clock continuity, grounded opponent shots and fixed cameras.
- Additional regressions reject the preferred player samples and recover using
  remaining real contacts, preserve a point zone, reject an impossible zone,
  and distinguish automatic player-shot preferences from configured constraints.
- Final focused run: 33 tests across rally search, Quick Rally, rendered contact
  timing and return-shot coverage pass after the flight-legality guard.
- Full current-workspace suite: 627 pass, 15 fail, across 62 files / 642 tests.
  All failures are in the storage and project-catalog tests, whose original
  default/count assumptions conflict with the owner's edited project catalogs.
  Both affected files pass all 32 tests with committed catalog fixtures supplied
  by a temporary test-only module resolver. No owner catalog was rewritten.
- Production build, TypeScript and active motion/precache guard pass. Existing
  bundle-size advisory remains. Existing rendered rig/contact tests pass.
- Actual Edge production preview using the owner's current saved Rally setup
  advanced to cycle 9 / 226 seconds without alerts or browser errors, with the
  authored camera unchanged. The rendered court and moving ball were inspected.
  Evidence: `C:/Users/20378/.codex/visualizations/2026/09/12/01a09414-f625-7dd2-ba82-d570264839e1/save-system/rally-recovered.png`.

Local implementation and verification; no public deployment.
