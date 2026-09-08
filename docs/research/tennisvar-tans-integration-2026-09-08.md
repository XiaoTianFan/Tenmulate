# Applying TennisVAR and TANS to Tenmulate

Research date: 2026-09-08. Status: **Proposed research direction**, not accepted architecture, implemented functionality, or a deployment plan.

Start with the [paper crash course](tennisvar-tans-crash-course-2026-09-08.md). This assessment interprets “TAMLate” in the request as **Tenmulate**, the current workspace.

## 1. Recommendation

Build a small, reviewed **chart → evidence → rehearsal** workflow before attempting automatic video analysis. Reuse TANS's spatial/event ideas and TennisVAR's evidence discipline. Keep Tenmulate's existing simulation and motion pipeline responsible for playable trajectories and contact timing.

The first useful deliverable would be a handful of understandable, source-linked tactical drills. Reproducing the full TennisVAR model is a later experiment with different data, compute, and evaluation requirements.

This recommendation follows from three observations:

- The current project already has deterministic shot/drill authoring and rehearsal.
- Neither notation nor tactical labels fully specify physical playback.
- TennisVAR's pretrained checkpoints and TRACE access procedure are still pending in the checked public release.

## 2. Current project fit

The repository was inspected at HEAD `96acb96`, with ongoing unrelated changes in the worktree, including session/rally/rhythm and UI work. Those files continued changing during this research. Statements about new worktree helpers are observations, not acceptance or test claims for that work. No unrelated edits were staged by this research.

| Current authority | Observed capability/boundary | Integration implication |
| --- | --- | --- |
| [README](../../README.md), [architecture](../technical-architecture.md) | Browser-based first-person tennis rehearsal; local-first React/TypeScript/Three.js system | Add reviewed content and learning interactions around the player. |
| [Content types](../../src/content/types.ts) | Shot definitions include source/target, pace, spin, family, hand, and optional contact-related authoring constraints; drills refer to shot IDs and event overrides | Existing playback data is useful but is not a complete chart of a historical point. |
| [Import validation](../../src/content/validation.ts) | Versioned allowlists; shot-ID validation; event target bounds for the near singles court | A TANS file needs a dedicated parser/adapter. Adding arbitrary evidence fields to current drill JSON will be rejected. |
| [Court domain](../../src/domain/court.ts) | Court dimensions and explicit player-view/world-x conversion | Coordinate conversion belongs here or in a tested adapter, not in a language-model prompt. |
| [Session compiler](../../src/engine/session/compileSession.ts) | Resolves shots and coordinates repetition/movement timing | Convert reviewed constraints to a rehearsal recipe, then compile it through the existing engine. |
| [Physics](../../src/engine/trajectory/physics.ts) | Numerical ball trajectories, bounce and net behavior | Research labels cannot override physical feasibility. |
| [Motion contract](../development/local-motion-pipeline.md), [ADR-0012](../decisions/0012-local-opponent-motion-pipeline.md) | Reference-led motion production belongs in the sibling laboratory; gameplay integration preserves contact and recovery | Chart analysis does not generate a new motion library or authorize changing it. |
| [ADR-0002](../decisions/0002-v1-scope-and-release-model.md) | V1 has no runtime camera capture, movement detection, or user swing grading | Offline analysis of selected match footage is separable from observing the person rehearsing. Tracking remains a separate decision. |

The dirty worktree also contained `rally.ts`, `rhythm.ts`, and `playerCoverage.ts` helpers. They may improve future sequencing, but a simulated return is not a measured human return. This assessment does not claim that the current app implements full historical-rally reconstruction or doubles tactics.

## 3. The shared data model should be richer than either paper's interchange

Use three related records rather than one overloaded drill object. These names and fields are a proposal, not an existing schema or the official TRACE schema.

| Record | Contents | What it means |
| --- | --- | --- |
| Rally record | Match/point/player IDs, source, ordered contacts, pre-shot positions, stroke attributes, destinations, uncertainty | What was observed or charted |
| Tactical annotation | Taxonomy version, question, answer, evidence event IDs, key actions, observed result, reviewer/model provenance | An interpretation of those observations |
| Rehearsal recipe | Selected perspective, target regions, chosen pace/spin/contact heights, motion mapping, deterministic seed, timing mapping | How to simulate an exercise based on the observations |

Essential event fields would include:

```text
eventId, rallyId, sequenceIndex, hitterPlayerId
sourceVideoId, sourceContactFrame, sourceContactPts, sourceTimebase
courtOrientation, playersBeforeContact
strokeFamily, strokeSide, technique, intendedDirection
destination: { kind: bounce | interception | out | unknown, zone, optionalXY }
pointOutcome, observedConfidence, annotationProvenance
```

Source frame/time fields must be nullable for manually charted material without video alignment. A confidence value requires a defined origin; do not fabricate numerical confidence to fill the schema. A manually chosen center-of-zone position belongs among rehearsal assumptions, not measured coordinates.

Stable IDs matter. Camera-relative Near/Far labels should map to persistent players for each source segment. A change of ends or camera cut must not silently exchange player identities. Team membership needs its own field for doubles.

Tactical evidence must reference valid ordered events. Key actions should be a subset of supporting events, and missing evidence should remain an explicit unanswerable/review state. Labels and explanations may be revised without rewriting the original event observations.

## 4. Converting TANS safely and usefully

### Parse a declared dialect

Start with the paper's coarse grid and explicit version. Preserve the raw token, source line, and parsed result. Flag unknown or contradictory endings such as the manuscript's `YF` example. A documented legacy dialect may later map alternatives; silent substitutions would obscure evidence.

The fine-grid appendix is a separate extension. Its line/region distinction, including the center-line `c`, needs a geometric definition before conversion.

### Map regions, not fictional exact positions

Use Figure 2's unequal partitions and reconcile its rounded dimensions with Tenmulate's canonical court dimensions. A zone maps to a region or interval. A rehearsal can choose a point in that region deterministically, but the UI should identify the result as reconstructed practice.

Tenmulate's player-view horizontal convention is especially relevant: positive world x appears on the player's left from the near baseline. Camera orientation and court end must be explicit in the adapter. Avoid a generic “A means negative x” rule without establishing the chosen reference view.

Some outer TANS regions can overlap singles and doubles space. Do not reject or accept a whole region solely by its letter; intersect it with the applicable court and preserve uncertainty near boundaries.

### Preserve interception and motion constraints

A TANS destination can be where a volley intercepted the ball. It must not automatically become a ground-bounce target. Existing shot families and their motion clips are not a one-to-one translation of TANS codes: `c` conveys slice, `v` may not tell us forehand/backhand, and `d` does not by itself specify a supported motion/trajectory combination.

Unknown hand, contact height, spin, and speed need reviewed authoring choices. Reject or leave unresolved an unsupported shot rather than substituting a different one invisibly. Keep ball pace independent of motion rhythm and preserve the shared recovery plan.

Store source time and rehearsal time separately. A slowed or adapted drill is useful, but it is not the original rally clock. Evidence navigation should go to the source contact; exercise navigation should go to the compiled event. Keep their mapping explicit.

## 5. Where TennisVAR would enter

In a later analysis service, it could propose stroke events and question-conditioned tactical annotations for selected rally videos. A reviewer would inspect the contact evidence, correct fields, and approve a rehearsal recipe. The browser could consume reviewed output without shipping the model into the rendering loop.

For simulated sessions, Tenmulate already knows its authored launches and computed trajectories. There is no need to rediscover those events by running a video detector on its own rendered output. That does not make synthetic data equivalent to TRACE's broadcast distribution or validate a tactical classifier on it.

TANS strings alone also cannot feed the released TGTR unchanged: its public configuration expects visual event features. A symbolic-only reasoner would be a different model or an ablation requiring its own training and evaluation.

Useful learning interactions include inspecting the buildup to an opportunity, comparing two reviewed explanations, pausing before the next shot to ask the learner for a choice, and rehearsing a selected target pattern. A choice exercise can record an answer or a coach's assessment without claiming to observe the learner's actual swing.

Counterfactual examples require an explicit distinction between “the match showed this” and “we generated this alternative.” Neither paper supplies a validated probability-of-winning engine for those alternatives.

## 6. Public release audit: paper versus executable implementation

The [official TennisVAR repository](https://github.com/WhynotGit2025/TennisVAR) was inspected at commit `cd9039ff6b4e181ae3820185c5e2ff133b55c1ae` on September 8, 2026. Source was read; the training/inference package was not installed or run.

| Item | Verified state |
| --- | --- |
| Paper/project website | Available |
| Core code and training interfaces | Public source available |
| Pretrained EPM/TGTR/LoRA weights | README says being prepared for release |
| TRACE annotations and split metadata | Release plan under review |
| Broadcast footage | Not distributed by the project |
| TrackNet trajectory | Public inference example accepts a separate `--ball-track` input; supported checkpoints require it |
| Software reuse license | No LICENSE file or declared project license field was found in the inspected tree/metadata; reuse permission is not established by public visibility |

Three implementation details deserve attention before any reproduction claim:

**Matching objective.** The paper's Eq. 9 specifies maximum-cardinality, minimum-offset one-to-one matching. The checked [training alignment function](https://github.com/WhynotGit2025/TennisVAR/blob/cd9039ff6b4e181ae3820185c5e2ff133b55c1ae/src/tennisvar/data/graph_qa.py#L181) and [event evaluation helper](https://github.com/WhynotGit2025/TennisVAR/blob/cd9039ff6b4e181ae3820185c5e2ff133b55c1ae/src/tennisvar/evaluation/event_metrics.py#L10) sort candidate pairs by distance and greedily accept unused endpoints.

With gold frames `[100,104]`, predicted frames `[103,105]`, and tolerance `3`, the current helper takes `103 ↔ 104` and returns one match. The admissible assignment `103 ↔ 100`, `105 ↔ 104` returns two. The exact standalone evaluation helper was exercised on this example. This establishes an objective mismatch; it does not quantify an effect on the paper's reported scores.

**Output ownership.** The paper says TGTR supplies tactic/evidence/key actions and Qwen supplies prose. The checked [selector](https://github.com/WhynotGit2025/TennisVAR/blob/cd9039ff6b4e181ae3820185c5e2ff133b55c1ae/src/tennisvar/tactical_reasoning/runtime.py#L127) returns ranked candidates. The [Qwen adapter](https://github.com/WhynotGit2025/TennisVAR/blob/cd9039ff6b4e181ae3820185c5e2ff133b55c1ae/src/tennisvar/generation/qwen.py#L125) filters generated evidence/key IDs against candidate membership, while the [public pipeline](https://github.com/WhynotGit2025/TennisVAR/blob/cd9039ff6b4e181ae3820185c5e2ff133b55c1ae/src/tennisvar/pipeline.py#L101) constructs evidence from Qwen-selected IDs and omits the full hierarchical-label/key-action tuple from its final response. Candidate membership filtering alone does not enforce the complete paper contract.

**Evaluation completeness.** The inspected [internal evaluator](https://github.com/WhynotGit2025/TennisVAR/blob/cd9039ff6b4e181ae3820185c5e2ff133b55c1ae/src/tennisvar/training/eval.py#L56) reports event-ID evidence F1, key-action set equality, per-level accuracy, and optional visual metrics. The separately inspected event evaluator covers contact detection. These are useful components, but they do not establish an available, verified reproduction of all ten headline TRACE metrics and the combined table. In particular, internal per-level accuracy should not be relabeled hierarchical F1.

The training config broadly matches the paper's schedule: EPM 40 epochs, TGTR 120, and rank-32 Qwen LoRA 5. Agreement on settings is insufficient to certify identical data, outputs, or results.

## 7. A proportionate first experiment

This is proposed future work, not work carried out in this research task.

1. **Choose 20-40 reviewable singles rallies**, covering a few interpretable patterns and some failures or ambiguous cases. Use owner-selected accessible sources; preserve complete point outcomes. This is a feasibility pilot, not a statistically conclusive coaching study.
2. **Chart and align events manually first.** Validate TANS tokens, orientation, players, interception/bounce distinctions, and source contact anchors. Measure disagreements between reviewers where possible.
3. **Create two or three reviewed teaching patterns.** A wide serve followed by play into the open space is one illustrative candidate. Define what the learner should observe and practice without assigning an unsupported success probability.
4. **Author compatible rehearsal recipes.** Map each assumption to an existing shot/motion capability, retain source links, validate trajectories and recovery, and inspect actual blended/IK gameplay.
5. **Compare learning with and without evidence links.** Start with comprehension and usability; any claim of improved on-court performance requires a separate training study.
6. **Evaluate automation only after the workflow is useful.** Add detector/reasoner suggestions, measure correction effort, and require improvement over manual or simple rule-assisted authoring.

Suggested pilot acceptance criteria:

- Every accepted chart parses under its declared dialect; ambiguous examples produce an explicit review issue.
- Every evidence link resolves to the right rally/event and source moment; no dangling key-action IDs.
- Court-end changes, left/right conversions, pre-shot positions, and interceptions survive import correctly.
- Missing physical quantities are visibly marked as authoring assumptions rather than observations.
- Existing tests plus motion checks apply if implementation changes affect those paths; live rendered contacts, recovery, and both-hand cases remain part of acceptance.
- Outputs are useful for a learner to explain the pattern; no unsupported “optimal shot” or win-probability claim appears.

Doubles should follow a separate capability assessment. Four interacting players, partner coverage, poaching, and volley interception are material additions to a first-person opponent rehearsal system. The TANS doubles findings should not be presented as already supported gameplay.

## 8. Source and retrieval receipts

### TennisVAR

- Original metadata: [arXiv 2608.12920](https://arxiv.org/abs/2608.12920).
- Retrieved original: [versioned PDF](https://arxiv.org/pdf/2608.12920v1).
- Local file: `F:\Codes\Tenmulate\output\pdf\TennisVAR-2608.12920v1.pdf`.
- Pages: 9. Bytes: 4,290,881.
- SHA-256: `6197edc0fd13239d14cce535d5c7fb9d13b97f5d2cad0b1ec04eaee8e095b7b6`.
- PDF license metadata: arXiv perpetual non-exclusive distribution license. This is not a software license or a rights grant for underlying broadcast video.
- [Authors' project page](https://whynotgit2025.github.io/TennisVAR/), [public source revision](https://github.com/WhynotGit2025/TennisVAR/tree/cd9039ff6b4e181ae3820185c5e2ff133b55c1ae).

### TANS

- User-provided original: `F:\Codes\Tenlysis\doc\ISACE25-TANS.pdf`.
- Verified byte-identical [author-hosted PDF](https://tennis-ans.github.io/publications/ISACE25-TANS.pdf).
- Pages: 15. Bytes: 5,588,513.
- SHA-256: `6fcb4423bab96f13c091de24156244b520d37680682f093c272b2add72f17287`.
- [Project/tools](https://tennis-ans.github.io/), [charted-data interface](https://tennis-ans.github.io/data/).
- The site advertises a statistics analyzer, TennisAbstract converter, and API archive. The archive and hosted analysis were not executed or audited, and the 111-point evaluation dataset was not independently reproduced.

### Verification scope

The review checked paper identity/version, PDF integrity, full text and relevant rendered figures/tables, key arithmetic, the public release description, selected implementation contracts, and the current local architecture. It found the matching counterexample through a bounded pure-function check. No ML inference, model training, source-video acquisition, application code change, or deployment was performed.
