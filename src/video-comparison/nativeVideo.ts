import { frameSeekTime, type FrameIndex } from './timeline';
import type { ReviewFrame, FrameRequests } from './videoFrames';
import { reviewSize } from './mediaResources';
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

/** WebKit needs an attached, muted inline player to reliably produce pixels. */
export function mountNativeVideo(video: HTMLVideoElement, host?: HTMLElement) {
  video.muted = true; video.defaultMuted = true; video.playsInline = true; video.preload = 'auto';
  video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', ''); video.setAttribute('aria-hidden', 'true');
  video.className = 'video-decoder-surface';
  // A card/thumbnail may be outside a horizontal or vertical scroll viewport.
  // WebKit can report seeked/readyState=4 there yet return all-black drawImage
  // pixels. Keep the decoder in the render viewport, inside the active dialog
  // when applicable; only the owned canvas is the user-facing review surface.
  const dialog = host?.closest('dialog[open]') ?? document.querySelector('dialog[open]');
  Object.assign(video.style, { position: 'fixed', top: dialog ? '50%' : '0', left: dialog ? '50%' : '0', width: '2px', height: '2px', opacity: '0.01', pointerEvents: 'none' });
  (dialog ?? document.body).append(video);
}

export async function openNativeVideo(video: HTMLVideoElement, url: string, signal: AbortSignal) {
  try {
    await waitForMedia(video, 'loadeddata', signal, () => {
      video.src = url; video.load();
      // Loaded data owns completion; a play promise itself can remain pending.
      void video.play().catch(() => {});
    });
  } finally { video.pause(); }
}

export async function seekNativeVideo(video: HTMLVideoElement, time: number, signal: AbortSignal) {
  video.pause();
  if (!video.seeking && video.readyState >= 2 && Math.abs(video.currentTime - time) < 1e-7) return;
  await waitForMedia(video, 'seeked', signal, () => { video.currentTime = time; });
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) throw new Error(DECODE_ERROR);
}

export async function* nativeFrames(file: File, index: FrameIndex, requests: FrameRequests, first: number, signal: AbortSignal, maxPixels?: number): AsyncGenerator<ReviewFrame> {
  const video = document.createElement('video'), url = URL.createObjectURL(file);
  let previousFrame = -1;
  try {
    mountNativeVideo(video);
    await openNativeVideo(video, url, signal);
    for (let i = first; i < requests.length; i++) {
      signal.throwIfAborted();
      const frame = requests.at(i), time = frameSeekTime(index, frame);
      // currentTime may be privacy-rounded. Our own last request is a safer
      // cache key for this isolated player than reading its media clock.
      if (frame !== previousFrame) {
        await seekNativeVideo(video, time, signal);
        previousFrame = frame;
      }
      signal.throwIfAborted();
      const snapshot = document.createElement('canvas');
      const size = maxPixels ? reviewSize(video.videoWidth, video.videoHeight, maxPixels) : { width: video.videoWidth, height: video.videoHeight };
      snapshot.width = size.width; snapshot.height = size.height;
      try {
        const context = snapshot.getContext('2d', { alpha: false });
        if (!context || !snapshot.width || !snapshot.height) throw new Error(DECODE_ERROR);
        context.drawImage(video, 0, 0, snapshot.width, snapshot.height);
      } catch (error) { snapshot.width = snapshot.height = 0; throw error; }
      yield { frame, width: video.videoWidth, height: video.videoHeight, bytes: snapshot.width * snapshot.height * 4,
        draw: (target, x, y, width, height) => target.drawImage(snapshot, x, y, width, height),
        close: () => { snapshot.width = snapshot.height = 0; } };
    }
  } finally { video.pause(); video.removeAttribute('src'); video.load(); video.remove(); URL.revokeObjectURL(url); }
}

