# ADR-0031: Measured renderer cost and off-thread preview preparation

- Status: Accepted for local implementation
- Date: 2026-09-08
- Extends: ADR-0001 (WebGL renderer), ADR-0018 (continuous practice preview), ADR-0020 (shared court)

## Evidence

The user's Edge and Codex tabs selected different physical GPUs. Controlled tests
also found GPU fragment cost from four visible but unlit stadium fixtures and the
physical sky shading behind opaque geometry. A longer default rally revealed
115–124 ms synchronous compilation stalls at six-shot preview boundaries.
See the [measurement receipt](../development/renderer-performance-2026-09-08.md).

## Decision

1. Keep WebGL, authored geometry, materials, PCF shadows, sky, audience, weather,
   net filtering, ball highlight and gameplay sampling intact. Exclude fixture
   lights only when their computed intensity is exactly zero, and restore every
   nonzero light. Render the far-depth sky after opaque geometry and before the
   renderer's transparent pass, allowing depth rejection of hidden cloud shading.
2. Reuse the optional trail's GPU attribute/geometry and refresh its bounds. Read
   the rig contact anchor only during the diagnostic contact window; do not reduce
   rig, IK, ball or camera update frequency.
3. Prepare the next unused six-shot preview batch in one module worker while the
   current and next batches play. The worker calls the same deterministic compiler
   and interval solver, with the same cycle seeds. Apply its results at the same
   boundary as before; no clock, trajectory, distribution or motion-rate changes.
4. Maintain a bounded single prefetched batch and one worker per active preview.
   Seek invalidates stale results; session replacement/disposal terminates queued
   work. If a worker is unavailable or a seek overtakes preparation, compile the
   identical batch synchronously to preserve the sequence. Diagnostics report
   worker/synchronous mode and cache misses. Initial setup still compiles the first
   two batches synchronously. Launched finite sessions remain precompiled.
5. Add opt-in, bounded CPU stages and asynchronous GPU queries. Report actual GPU,
   drawing-buffer area, quality, shadow size, resources and RAF cadence separately.
   Ship a controlled benchmark without adding runtime profiling dependencies.

## Verification and limits

344 tests pass, including async/synchronous sequence equivalence, seeking, stale
results, worker errors/disposal, and GPU-query lifecycle. The production worker is
49.3 kB and is included in the offline precache. Nine rendered lighting/venue
comparisons retain every visual feature; differences are at most one 8-bit color
level on six of 1,024,000 pixels. Three continuously advancing preview transitions
use prefetched batches, with no misses and a 0.7 ms maximum session stage.

The OS/browser controls adapter selection. The app's high-performance request
cannot guarantee the RTX GPU. Headless GPU duration is not end-to-end foreground
FPS, and the two browsers' original differently sized/differently rendered views
must not be used as an equivalent benchmark. Public deployment and extended device
acceptance remain separate from this local performance verification.
