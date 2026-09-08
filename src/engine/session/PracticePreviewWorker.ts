import type { PreviewBatch, PreviewBatchCompiler, PreviewBatchRequest } from './practicePreview';

/** One pending job per preview; replacing a session cancels its old CPU work. */
export class PracticePreviewWorker implements PreviewBatchCompiler {
  private worker: Worker | null = null;
  private reject: ((reason: Error) => void) | null = null;

  compile(request: PreviewBatchRequest): Promise<PreviewBatch> {
    if (this.reject) this.dispose();
    return new Promise((resolve, reject) => {
      this.reject = reject;
      try {
        this.worker ??= new Worker(new URL('./practicePreview.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = ({ data }: MessageEvent<PreviewBatch>) => {
          this.reject = null; resolve(data);
        };
        this.worker.onerror = () => this.dispose();
        this.worker.onmessageerror = () => this.dispose();
        this.worker.postMessage(request);
      } catch (error) { this.dispose(); reject(error); }
    });
  }

  dispose(): void {
    this.worker?.terminate(); this.worker = null;
    this.reject?.(new Error('Preview preparation cancelled or unavailable')); this.reject = null;
  }
}
