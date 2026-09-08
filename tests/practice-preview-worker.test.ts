import { afterEach, describe, expect, it, vi } from 'vitest';
import { PracticePreviewWorker } from '../src/engine/session/PracticePreviewWorker';
import type { PreviewBatchRequest } from '../src/engine/session/practicePreview';

const instances: FakeWorker[] = [];
class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { instances.push(this); }
}
afterEach(() => { vi.unstubAllGlobals(); instances.length = 0; });

describe('preview worker ownership', () => {
  it('reuses one worker and releases it on disposal', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const client = new PracticePreviewWorker();
    const request = { cycle: 2 } as PreviewBatchRequest;
    const first = client.compile(request);
    expect(instances[0]!.postMessage).toHaveBeenCalledWith(request);
    instances[0]!.onmessage!({ data: { next: 'batch' } });
    await expect(first).resolves.toEqual({ next: 'batch' });
    const second = client.compile(request);
    expect(instances).toHaveLength(1);
    const cancelled = expect(second).rejects.toThrow('cancelled');
    client.dispose(); await cancelled;
    expect(instances[0]!.terminate).toHaveBeenCalledOnce();
  });

  it('terminates stale queued work when a seek supersedes the pending batch', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const client = new PracticePreviewWorker();
    const old = client.compile({ cycle: 2 } as PreviewBatchRequest);
    const cancelled = expect(old).rejects.toThrow('cancelled');
    const next = client.compile({ cycle: 5 } as PreviewBatchRequest);
    await cancelled;
    expect(instances[0]!.terminate).toHaveBeenCalledOnce();
    expect(instances).toHaveLength(2);
    instances[1]!.onmessage!({ data: { next: 'fresh' } });
    await expect(next).resolves.toEqual({ next: 'fresh' }); client.dispose();
  });

  it('rejects and cleans up both script and deserialization failures', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    for (const event of ['onerror', 'onmessageerror'] as const) {
      const client = new PracticePreviewWorker();
      const result = client.compile({} as PreviewBatchRequest);
      const rejected = expect(result).rejects.toThrow('unavailable');
      const worker = instances.at(-1)!; worker[event]!();
      await rejected; expect(worker.terminate).toHaveBeenCalledOnce();
    }
  });
});
