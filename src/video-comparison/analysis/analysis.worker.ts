import { PointTracker, type PixelFrame } from './tracker';
import type { Anchor } from './types';
let tracker = new PointTracker();
// Dedicated entry points prevent a lazy model chunk from importing/reinitializing
// the entry module in WebKit's worker module map. The client serializes requests.
self.onmessage = ({ data }: MessageEvent<{ id: number; type: 'track'; frame: PixelFrame; anchor?: Anchor }>) => {
  try {
    let result;
    if (data.anchor) {
      tracker = new PointTracker(); tracker.reset(data.frame, data.anchor);
      result = { x: data.anchor.x, y: data.anchor.y, confidence: 1 };
    } else result = tracker.next(data.frame);
    self.postMessage({ id: data.id, result });
  } catch (error) { self.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Analysis failed. Try a shorter excerpt.' }); }
};
