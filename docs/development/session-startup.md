# Practice startup and preparation

Current contract: 2026-09-16. Applies to Quick Practice, the drill library and
editor Test drill. Existing motion, contact and feasibility rules still apply.

## Configuration work

Session compilers reuse one idle worker and retain up to three exact-input results
per compiler. Quick previews and complete practice sets have separate caches.
Concurrent consumers of identical inputs join one job. An abort removes only that
consumer; an unneeded job is terminated and late results are ignored. Failed jobs
are never cached. Keys include drill contents, seed, all settings and shot selection.

Quick Practice warms the complete set after 200 ms of unchanged settings. The drill
library warms its selected drill, handedness, rhythm, intervals and practice-set
counts after 100 ms. The editor warms Test drill separately from isolated-shot
previews. Start consumes the completed result or joins its in-flight job. Editing
any input invalidates the match; cached results never replace a different setup.
The rehearsal module is loaded during configuration, not first requested by Start.

The first quick preview uses three shots and a prepared three-shot continuation.
Later continuations keep the six-shot batch. This preserves T/body/wide coverage
while reducing the initial solve. Parameter edits debounce for 50 ms; mode switches
have no debounce. Set/rest counts do not change the continuous preview cache key.
Repeated pace/spin candidates reuse their deterministic downstream acceptance check.
No contact, net, landing or motion-feasibility tolerances were weakened.

## Starting and resetting

Start immediately stops and detaches the configuration preview, cancels its future
batch worker, clears the visible ball and resets the preview clock. While an
uncached set finishes, the opponent stays ready instead of continuing to serve.
Leaving configuration cancels that pending launch.

The shared canvas, loaded model and venue survive the handoff. Scene creation and
session/trajectory/clock changes run in layout effects. A new session or clock resets
the renderer's elapsed time, active repetition and ball visibility before playback;
the session player also resets before paint. The configured camera is reapplied
when viewport ownership changes. Reusing a cached session still starts at zero.
The authored countdown is rehearsal time, distinct from calculation/network latency.

## Evidence and limits

On the development workstation, the prior shipped Rally took about 1.76 s for its
six-shot preview plus 1.00 s for the prepared continuation, and 6.02 s for a complete
set. With smaller initial batches, the production browser measured about 1.20 s for
the preview. Full solves still cost CPU time; warming moves that work before Start.
Prepared production starts measured about 64 ms for Rally and 63 ms for a two-run
serve-return drill; the first Return handoff measured 366 ms. These are observed
local timings, not hardware-independent budgets.

Development and production browser checks verify the same canvas survives and the
opponent changes from an active preview to ready with the new clock below 0.1 s.
An artificially delayed uncached launch stays at zero/ready with its ball hidden,
then starts its own clock. Cache tests cover deduplication, cancellation ownership,
late replies, invalidation, eviction and errors. Preview tests cover the short-batch
seam and rewind. Physics/session regression checks and build remain required.

A brand-new or just-edited complex set can still require a solve if Start is pressed
before warmup finishes. Arbitrary authored constraints are not replaced with a fake
or mismatched sequence to claim zero latency. Cold asset downloads and device GPU
startup also remain separate from session calculation.
