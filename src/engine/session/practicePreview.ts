import type { DrillDefinitionV1 } from '../../content/types';
import { compileSession, type CompiledRepetition, type CompiledSession, type SessionSettings } from './compileSession';
import { motionEvent, type MotionEvent } from './opponentTimeline';
import { solveShotInterval } from './shotTiming';
import { sessionFlights, type SessionFlight } from './sessionFlights';

/** Preview batches ignore planned set/rest counts. Six feeds cover alternating
 * sides, three step offsets and T/body/wide serves. The next batch is fresh. */
export function compilePracticePreview(drill: DrillDefinitionV1, settings: SessionSettings): CompiledSession {
  const session = compileSession(drill, { ...settings, repetitions: 6, workBlockSize: 6, restSeconds: 0 });
  return { ...session, previewLoop: true };
}

type PreviewFrame = Readonly<{
  cycle: number; flights: readonly SessionFlight[]; events: readonly MotionEvent[];
  repetition: CompiledRepetition; nextContact: number;
}>;

export type PreviewBatchRequest = Readonly<{
  drill: DrillDefinitionV1; settings: SessionSettings; last: CompiledRepetition; cycle: number;
}>;
export type PreviewBatch = Readonly<{ last: CompiledRepetition; next: CompiledSession }>;
export type PreviewBatchCompiler = {
  compile(request: PreviewBatchRequest): Promise<PreviewBatch>;
  dispose(): void;
};

/** The same deterministic compilation and seam fitting run in either thread. */
export function preparePreviewBatch({ drill, settings, last, cycle }: PreviewBatchRequest): PreviewBatch {
  const next = compilePracticePreview(drill, { ...settings, seed: `${settings.seed}:preview:${cycle}` });
  const first = next.repetitions[0]!, requested = settings.shotIntervalSeconds!;
  const solved = solveShotInterval(last, first, requested), gap = solved.gap;
  const offset = last.startTime + gap - first.startTime;
  return {
    last: { ...solved.previous, timing: { requested, actual: gap, limited: solved.limited } },
    next: { ...next, duration: next.duration + offset,
      repetitions: next.repetitions.map(rep => ({ ...(rep === first ? { ...rep,
        motionRate: solved.next.motionRate, movementRate: solved.next.movementRate,
        preparedApproach: solved.next.preparedApproach } : rep), startTime: rep.startTime + offset })) },
  };
}

/** Bounded three-batch window on the same absolute session clock. Keeping the
 * previous flight and next preparation avoids both ball loss and pose resets. */
export class ContinuousPracticePreview {
  private previous: CompiledSession | null = null;
  private current: CompiledSession;
  private next: CompiledSession;
  private cycle = 0;
  private events: readonly MotionEvent[] = [];
  private prepared: Readonly<{ cycle: number; batch: PreviewBatch }> | null = null;
  private generation = 0;
  private disposed = false;
  private workerFailed = false;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(private readonly initial: CompiledSession, private readonly compiler?: PreviewBatchCompiler) {
    this.current = initial;
    this.next = this.following(initial, 1);
    this.updateEvents();
    this.prefetch();
  }

  private following(previous: CompiledSession, cycle: number): CompiledSession {
    const cached = this.prepared?.cycle === cycle ? this.prepared.batch : null;
    if (cycle > 1) { if (cached) this.cacheHits++; else this.cacheMisses++; }
    const batch = cached ?? preparePreviewBatch(this.request(previous, cycle));
    this.prepared = null;
    const last = previous.repetitions.at(-1)!;
    // This boundary is compiled at the beginning of the current batch, before
    // its last stroke plays. Raising rates shrinks occupied stroke windows.
    this.current = { ...previous, repetitions: previous.repetitions.map(rep => rep === last ? batch.last : rep) };
    return batch.next;
  }

  private request(previous: CompiledSession, cycle: number): PreviewBatchRequest {
    return { drill: this.initial.drill, settings: this.initial.settings, last: previous.repetitions.at(-1)!, cycle };
  }

  private prefetch(): void {
    if (!this.compiler || this.workerFailed || this.disposed) return;
    const generation = ++this.generation, cycle = this.cycle + 2;
    this.compiler.compile(this.request(this.next, cycle)).then(batch => {
      if (!this.disposed && generation === this.generation) this.prepared = { cycle, batch };
    }).catch(() => {
      if (!this.disposed && generation === this.generation) this.workerFailed = true;
    });
  }

  get preparation() {
    return { mode: this.compiler && !this.workerFailed ? 'worker' : 'synchronous',
      ready: this.prepared !== null, cacheHits: this.cacheHits, cacheMisses: this.cacheMisses };
  }

  dispose(): void {
    this.disposed = true; this.generation++; this.prepared = null; this.compiler?.dispose();
  }

  private updateEvents(): void {
    this.events = [this.previous, this.current, this.next].flatMap(session => session?.repetitions.map(motionEvent) ?? []);
  }

  frame(elapsed: number): PreviewFrame {
    if (this.cycle > 0 && elapsed < this.current.repetitions[0]!.startTime) {
      this.prepared = null; this.generation++;
      this.previous = null; this.current = this.initial; this.cycle = 0;
      this.next = this.following(this.current, 1); this.updateEvents(); this.prefetch();
    }
    while (elapsed >= this.next.repetitions[0]!.startTime) {
      this.previous = this.current; this.current = this.next; this.cycle++;
      this.next = this.following(this.current, this.cycle + 1); this.updateEvents(); this.prefetch();
    }
    const flights = [this.previous, this.current].flatMap(session => session ? sessionFlights(session, elapsed) : []);
    flights.sort((a, b) => a.time - b.time);
    const repetition = [...this.current.repetitions].reverse().find(rep => elapsed >= rep.startTime) ?? this.current.repetitions[0]!;
    return { cycle: this.cycle, flights, events: this.events, repetition, nextContact: this.next.repetitions[0]!.startTime };
  }
}
