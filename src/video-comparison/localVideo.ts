import type { FrameIndex } from './timeline';
import { MediaQueue } from './mediaResources';
const indexing = new MediaQueue();

export function indexVideo(file: File, signal: AbortSignal): Promise<FrameIndex> {
  return indexing.run(signal, () => new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const worker = new Worker(new URL('./indexVideo.worker.ts', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => { clean(); reject(new Error('Reading this clip took too long. Try a shorter clip.')); }, 60_000);
    const clean = () => { clearTimeout(timer); worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { clean(); reject(new DOMException('Aborted', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<{ index?: FrameIndex; error?: string }>) => {
      clean();
      if (data.index) resolve(data.index); else reject(new Error(data.error));
    };
    worker.onerror = () => { clean(); reject(new Error('Cannot read this video. Try an MP4, MOV or WebM file.')); };
    worker.postMessage(file);
  }));
}
