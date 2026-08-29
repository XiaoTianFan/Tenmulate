# Documentation process

This folder is the project record for product discovery, design, architecture, and delivery. Documentation changes should land with the implementation or decision that makes them necessary.

## Structure

- `product-requirements.md`: the product contract for the current intended release.
- `technical-architecture.md`: the current system design and boundaries.
- `research/`: dated research and option comparisons. Claims that can drift should link to primary sources and record the research date.
- `decisions/`: architecture decision records (ADRs). ADRs are append-only once accepted; later changes should supersede them with a new ADR.
- `roadmap.md`: milestone order and validation gates, not a promise of calendar dates.
- `open-questions.md`: unresolved owner choices and research spikes.

## Status language

- **Draft**: being explored; content may change without a superseding decision.
- **Proposed**: a specific recommendation awaiting owner approval or prototype evidence.
- **Accepted**: the active decision that implementation must follow.
- **Superseded**: retained for history but replaced by a later document.

## Design and delivery loop

1. Clarify the user, room, display, and training assumptions.
2. Approve the V1 scope and measurable acceptance criteria.
3. Generate a complete primary-screen visual concept and critical states, then obtain owner approval.
4. Run a thin renderer, trajectory, animation-sync, and display-calibration spike.
5. Accept or revise the relevant ADRs based on measured evidence.
6. Implement one vertical slice at a time, updating requirements and technical notes with each slice.
7. Verify ball behavior numerically and the visible experience in supported browsers and target display sizes.

## Decision index

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](decisions/0001-web-rendering-and-simulation-architecture.md) | Proposed | React/Vite shell, direct Three.js runtime, benchmarked WebGPU path, and tennis-specific ball solver |

## Change discipline

- Product changes update the PRD and, when architectural, add or supersede an ADR.
- Every shot preset must be data-defined, deterministic, and covered by trajectory acceptance tests.
- Asset licenses, source files, export settings, and animation-contact metadata must be recorded before an asset can ship.
- Deployment, camera capture, accounts, telemetry, and body tracking require explicit decisions; they are not implicit consequences of building the V1 front end.
