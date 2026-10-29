import { frameSeekTime, type FrameIndex } from './timeline';
import type { ReviewFrame, FrameRequests } from './videoFrames';
const DECODE_ERROR = 'Unable to decode this video. Try converting it to H.264 MP4.';

/** Native decoding is intentionally isolated from the visible review element. */
export function waitForMedia(video: HTMLVideoElement, event: 'loadeddata' | 'seeked', signal: AbortSignal, action: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const clean = () => { clearTimeout(timer); video.removeEventListener(event, ready); video.removeEventListener('error', fail); signal.removeEventListener('abort', abort); };
    const ready = () => { clean(); resolve(); };
    const fail = () => { clean(); reject(new Error(DECODE_ERROR)); };
    const abort = () => { clean(); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(fail, 12_000);
    video.addEventListener(event, ready, { once: true }); video.addEventListener('error', fail, { once: true }); signal.addEventListener('abort', abort, { once: true });
    try { action(); } catch (error) { clean(); reject(error); }
  });
}

export async function* nativeFrames(file: File, index: FrameIndex, requests: FrameRequests, first: number, signal: AbortSignal): AsyncGenerator<ReviewFrame> {
  const video = document.createElement('video'), url = URL.createObjectURL(file);
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  let previousFrame = -1;
  try {
    await waitForMedia(video, 'loadeddata', signal, () => { video.src = url; });
    for (let i = first; i < requests.length; i++) {
      signal.throwIfAborted();
      const frame = requests.at(i), time = frameSeekTime(index, frame);
      // currentTime may be privacy-rounded. Our own last request is a safer
      // cache key for this isolated player than reading its media clock.
      if (frame !== previousFrame) {
        await waitForMedia(video, 'seeked', signal, () => { video.currentTime = time; });
        previousFrame = frame;
      }
      signal.throwIfAborted();
      const snapshot = document.createElement('canvas');
      snapshot.width = video.videoWidth; snapshot.height = video.videoHeight;
      const context = snapshot.getContext('2d', { alpha: false });
      if (!context || !snapshot.width || !snapshot.height) throw new Error(DECODE_ERROR);
      context.drawImage(video, 0, 0);
      yield { frame, width: snapshot.width, height: snapshot.height, bytes: snapshot.width * snapshot.height * 4,
        draw: (target, x, y, width, height) => target.drawImage(snapshot, x, y, width, height),
        close: () => { snapshot.width = snapshot.height = 0; } };
    }
  } finally { video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
}

