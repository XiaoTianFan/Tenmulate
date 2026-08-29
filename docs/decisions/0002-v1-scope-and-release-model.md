# ADR-0002: V1 scope, audience, release model, and V2 boundary

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decision owner:** Project owner

## Context

The initial planning baseline separated core baseline/return functionality from should-have and V1.1 candidates. It also left the first audience, display target, opponent style/handedness, cloud-asset policy, and release model open. The owner clarified that V1 should be a complete product whose defining exclusion is real-time player observation, not a narrow content prototype.

## Decision

1. V1 is a complete public-free browser product for the owner, players across multiple levels, and coaches.
2. All previously listed should-have and could-have features are V1 must-haves: full tactical camera movement, baseline/serve-return/net/overhead/serve-and-volley content, slow/exact replay, local timeline editing, JSON exchange, multiple visual variants, offline reuse, diagnostics, and an optional capability-gated high-refresh mode.
3. The product supports varied displays, viewing distances, rooms, and computers. It ships a realistic camera default and user-adjustable position, orientation/look target, and FOV/zoom rather than one hardware-specific view.
4. User handedness is not requested or modeled. Targets use absolute near-court left/body/right coordinates.
5. Both left- and right-handed opponents ship.
6. Opponent serves support at least two independently paced motion styles: normal high-toss/deeper-trophy and compact low-toss/immediate-upward. Ball pace remains a separate variable.
7. The visual target is game-realistic, prioritizing court credibility and opponent motion/contact over near-photoreal rendering.
8. V1 requests no camera access and performs no user movement/swing detection or grading.
9. V2 is defined by an explicitly enabled real-time camera/machine-learning movement-detection pipeline and synchronization of detected player movement with rendering/drill behavior.
10. Long-term freemium commercialization must reuse the same branding, rendering, simulation, and content pipeline. Accounts, payment, entitlements, and cloud services are a separate post-V1 track.

## Consequences

### Positive

- The release boundary is product-coherent: complete visualization in V1, sensed interaction in V2.
- Players can adapt pacing and view to skill, display, and comfort without a different build.
- The editor and deterministic content system become first-class rather than internal tooling.
- Public-free V1 can remain static/local-first while preserving a later commercial path.

### Costs and risks

- V1 motion, content, browser, offline, editor, and QA scope is materially larger than the original staged proposal.
- Both opponent hands and two serve rhythms increase animation capture and cleanup volume.
- “Various hardware” requires explicit quality tiers and honest capability messaging, not a universal 4K/120 fps claim.
- Public release requires provenance, privacy/legal, hosting, accessibility, and support readiness even without accounts.

## Implementation constraints

- No feature may silently reintroduce user handedness as a required setup field.
- Serve motion style and ball speed remain independent data fields.
- Camera preference controls cannot modify ball physics or court coordinates.
- V1 code must not request camera permission, bundle an inactive tracking SDK, or market technique analysis.
- Moving a feature out of V1 now requires an explicit superseding product decision, not a quiet roadmap edit.

## Supersedes

This ADR supersedes the V1 must/should/could and V1.1 priority split in the initial 2026-08-29 PRD/roadmap baseline. It does not accept the renderer or asset-authoring proposals in ADR-0001/ADR-0003; those still require technical evidence.
