# ADR-0014: Articulated player and complete motion library

- **Date:** 2026-09-07
- **Status:** Accepted implementation direction; technique and release acceptance remain separate
- **Supersedes:** ADR-0005/0012's original semi-realistic carrier selection and the provisional split base/animation delivery plan. Retains their local-production and deterministic-runtime boundaries.

## Decision

Use the owner's selected style of neutral articulated doll: the CC0 Quaternius
mannequin bound to the established 65-bone tennis armature, displayed at 1.88 m.
The prior stretched semi-realistic candidate was rejected for distorted head,
neck and shoulder proportions. Preserve the reviewed motions when rebinding.

Ship one hashed GLB containing the mannequin, rigid racket and the current
24-clip library. Keep source/model identity separate from the selected runtime
bundle manifest. The source pack's animation set is not part of our tennis library.

Normal and compact service rhythms are distinct authored clips at rate 1.
Compact uses a pinpoint gather, low toss and quick launch. Its first normal-speed
Kyrgios pass supplies cadence; same-camera slow replay supplies geometry only.
Ball pace remains independently controlled by the deterministic flight solver.

Use one absolute-time sampler and recovery planner in setup preview, sessions
and the lab's actual-renderer harness. Preserve contact anchors, handedness,
rigid grips and knee planes after blending/IK. Automatic recovery budgets inward
travel, split-step and next-shot approach. Explicit movement primitives stay
available without forcing jumps/slides into every hard-court recovery.

## Delivery and consequences

The frontend consumer verifies the selected model/library hashes, metadata and
calibration. Its production build precaches the active opponent bundle only.
Older bundles and lab baselines remain evidence until separately cleared.

The sibling lab owns source selection, recipes, fits, bakes and mechanical
reports. Production is reference-led authoring; optional extracted poses are
diagnostics. Preserve historical decisions and revision evidence, while the
[current motion runbook](../development/local-motion-pipeline.md) states the
current operational contract.

All prior motion/model feature commits must be reachable from local main before
claiming integration complete. Live actual-practice verification is distinct
from isolated lab checks. No public deployment or owner technique approval is
implied by a merge, green tests or documentation cleanup.

