import { PointTracker, type PixelFrame } from './tracker';
import { reconstructTrajectory, type TrackingPass } from './trajectory';
import type { Anchor } from './types';
import type { FrameIndex } from '../timeline';
let tracker = new PointTracker();
type Request = { id: number } & ({ type: 'track'; frame: PixelFrame; anchor?: Anchor; time: number; impact?: boolean }
  | { type: 'reconstruct'; index: FrameIndex; anchors: Anchor[]; forward: TrackingPass; backward: TrackingPass; width: number; height: number; contact: number | null });
// Keep the runtime imports static to avoid reinitializing a worker entry in WebKit.
self.onmessage = ({ data }: MessageEvent<Request>) => {
  try {
    let result;
    if (data.type === 'reconstruct') result = reconstructTrajectory(data.index, data.anchors, data.forward, data.backward, data.width, data.height, data.contact);
    else if (data.anchor) {
      tracker = new PointTracker(); tracker.reset(data.frame, data.anchor, data.time);
      result = { x: data.anchor.x, y: data.anchor.y, confidence: 1 };
    } else result = tracker.next(data.frame, data.time, data.impact);
    self.postMessage({ id: data.id, result });
  } catch (error) { self.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Analysis failed. Try a shorter excerpt.' }); }
};
