import type { FrameIndex } from './timeline';
import { frameSeekTime } from './timeline';

export function indexVideo(file: File, signal: AbortSignal): Promise<FrameIndex> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const worker = new Worker(new URL('./indexVideo.worker.ts', import.meta.url), { type: 'module' });
    const clean = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { clean(); reject(new DOMException('Aborted', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<{ index?: FrameIndex; error?: string }>) => {
      clean();
      if (data.index) resolve(data.index); else reject(new Error(data.error));
    };
    worker.onerror = () => { clean(); reject(new Error('Cannot read this video. Try an MP4, MOV or WebM file.')); };
    worker.postMessage(file);
  });
}

function waitFor(video: HTMLVideoElement, event: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const clean = () => {
      clearTimeout(timer); video.removeEventListener(event, done); video.removeEventListener('error', fail);
      signal.removeEventListener('abort', abort);
    };
    const done = () => { clean(); resolve(); };
    const fail = () => { clean(); reject(new Error('Your browser cannot play this video codec. Try H.264 MP4 or VP9 WebM.')); };
    const abort = () => { clean(); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = window.setTimeout(fail, 20_000);
    video.addEventListener(event, done, { once: true }); video.addEventListener('error', fail, { once: true });
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Bounded local-only filmstrip; a separate decoder never moves the review video. */
export async function makeFilmstrip(url: string, index: FrameIndex, signal: AbortSignal): Promise<string[]> {
  const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.preload = 'auto';
  try {
    const loaded = waitFor(video, 'loadeddata', signal); video.src = url; await loaded;
    const canvas = document.createElement('canvas'); canvas.width = 144; canvas.height = 90;
    const context = canvas.getContext('2d')!;
    const images: string[] = [];
    for (let i = 0; i < 12; i++) {
      signal.throwIfAborted();
      const time = frameSeekTime(index, Math.round(i / 11 * (index.timestamps.length - 1)));
      if (Math.abs(video.currentTime - time) > 0.00001) {
        const seeked = waitFor(video, 'seeked', signal); video.currentTime = time; await seeked;
      }
      context.fillStyle = '#030607'; context.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const width = video.videoWidth * scale, height = video.videoHeight * scale;
      context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      images.push(canvas.toDataURL('image/jpeg', 0.65));
    }
    return images;
  } finally { video.pause(); video.removeAttribute('src'); video.load(); }
}
