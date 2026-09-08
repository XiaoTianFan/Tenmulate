import type { DrillDefinitionV1 } from '../../content/types';
import { compileSession, type CompiledRepetition, type CompiledSession, type SessionSettings } from './compileSession';
import { minimumMotionGap, motionEvent, type MotionEvent } from './opponentTimeline';
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

/** Bounded three-batch window on the same absolute session clock. Keeping the
 * previous flight and next preparation avoids both ball loss and pose resets. */
export class ContinuousPracticePreview {
  private previous: CompiledSession | null = null;
  private current: CompiledSession;
  private next: CompiledSession;
  private cycle = 0;
  private events: readonly MotionEvent[] = [];

  constructor(private readonly initial: CompiledSession) {
    this.current = initial;
    this.next = this.following(initial, 1);
    this.updateEvents();
  }

  private following(previous: CompiledSession, cycle: number): CompiledSession {
    const next = compilePracticePreview(this.initial.drill, {
      ...this.initial.settings, seed: `${this.initial.settings.seed}:preview:${cycle}`,
    });
    const last = previous.repetitions.at(-1)!, first = next.repetitions[0]!;
    const requested = this.initial.settings.shotIntervalSeconds!;
    const gap = Math.max(requested, minimumMotionGap(last, { ...first, startTime: last.startTime + requested }));
    const offset = last.startTime + gap - first.startTime;
    return { ...next, duration: next.duration + offset,
      repetitions: next.repetitions.map(rep => ({ ...rep, startTime: rep.startTime + offset })) };
  }

  private updateEvents(): void {
    this.events = [this.previous, this.current, this.next].flatMap(session => session?.repetitions.map(motionEvent) ?? []);
  }

  frame(elapsed: number): PreviewFrame {
    if (this.cycle > 0 && elapsed < this.current.repetitions[0]!.startTime) {
      this.previous = null; this.current = this.initial; this.cycle = 0;
      this.next = this.following(this.current, 1); this.updateEvents();
    }
    while (elapsed >= this.next.repetitions[0]!.startTime) {
      this.previous = this.current; this.current = this.next; this.cycle++;
      this.next = this.following(this.current, this.cycle + 1); this.updateEvents();
    }
    const flights = [this.previous, this.current].flatMap(session => session ? sessionFlights(session, elapsed) : []);
    flights.sort((a, b) => a.time - b.time);
    const repetition = [...this.current.repetitions].reverse().find(rep => elapsed >= rep.startTime) ?? this.current.repetitions[0]!;
    return { cycle: this.cycle, flights, events: this.events, repetition, nextContact: this.next.repetitions[0]!.startTime };
  }
}
