import { expect, it } from 'vitest';
import { createSessionCompiler } from '../src/engine/session/sessionCompiler';
import type { CompiledSession } from '../src/engine/session/compileSession';

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  requests: object[] = [];
  terminated = false;
  postMessage(input: object) { this.requests.push(input); }
  terminate() { this.terminated = true; }
  complete(session: CompiledSession) { this.onmessage?.({ data: { session } } as MessageEvent); }
}
const session = { duration: 42 } as CompiledSession;
function fixture(capacity = 3) {
  const workers: FakeWorker[] = [];
  const compile = createSessionCompiler(() => { const worker = new FakeWorker(); workers.push(worker); return worker as unknown as Worker; }, capacity);
  return { workers, compile };
}

it('joins Start to an in-flight warmup and reuses the exact completed result', async () => {
  const { workers, compile } = fixture();
  const warmup = compile({ seed: '42', repetitions: 12 }), launch = compile({ seed: '42', repetitions: 12 });
  expect(workers).toHaveLength(1); expect(workers[0]!.requests).toHaveLength(1);
  workers[0]!.complete(session);
  expect(await warmup).toBe(session); expect(await launch).toBe(session);
  expect(await compile({ seed: '42', repetitions: 12 })).toBe(session);
  expect(workers[0]!.requests).toHaveLength(1);
});

it('lets Start finish when the configuration warmup unmounts', async () => {
  const { workers, compile } = fixture(), controller = new AbortController();
  const warmup = compile({ seed: 1 }, controller.signal), launch = compile({ seed: 1 });
  const cancelled = expect(warmup).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort(); await cancelled;
  expect(workers[0]!.terminated).toBe(false);
  workers[0]!.complete(session); expect(await launch).toBe(session);
});

it('terminates obsolete work and rejects late results without poisoning the cache', async () => {
  const { workers, compile } = fixture(), controller = new AbortController();
  const first = compile({ seed: 1 }, controller.signal), late = workers[0]!.onmessage!;
  const cancelled = expect(first).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort(); await cancelled;
  expect(workers[0]!.terminated).toBe(true);
  late({ data: { session } } as MessageEvent);
  const next = compile({ seed: 1 }); expect(workers).toHaveLength(2);
  workers[1]!.complete(session); await next;
});

it('keys every input, reuses idle workers, and bounds retained sessions', async () => {
  const { workers, compile } = fixture(1);
  const first = compile({ seed: 1, rest: 0 }); workers[0]!.complete(session); await first;
  const second = compile({ seed: 1, rest: 20 });
  expect(workers).toHaveLength(1); expect(workers[0]!.requests).toHaveLength(2);
  workers[0]!.complete({ ...session, duration: 62 }); await second;
  const evicted = compile({ seed: 1, rest: 0 }); expect(workers[0]!.requests).toHaveLength(3);
  workers[0]!.complete(session); await evicted;
});

it('does not retain failed calculations or start pre-aborted requests', async () => {
  const { workers, compile } = fixture(), controller = new AbortController(); controller.abort();
  await expect(compile({}, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(workers).toHaveLength(0);
  const failed = compile({}); workers[0]!.onmessage!({ data: { error: 'Invalid setup' } } as MessageEvent);
  await expect(failed).rejects.toThrow('Invalid setup'); expect(workers[0]!.terminated).toBe(true);
  const retry = compile({}); expect(workers).toHaveLength(2); workers[1]!.complete(session); await retry;
});
