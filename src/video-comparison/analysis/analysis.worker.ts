import { PointTracker, type PixelFrame } from './tracker';
import { reconstructTrajectory, type TrackingPass } from './trajectory';
import type { Anchor } from './types';
import type { FrameIndex } from '../timeline';
let tracker = new PointTracker();
type Request = { id: number } & ({ type: 'track'; frame: PixelFrame; anchor?: Anchor; time: number }
  | { type: 'reconstruct'; index: FrameIndex; anchors: Anchor[]; forward: TrackingPass; backward: TrackingPass; width: number; height: number });
// Keep the runtime imports static to avoid reinitializing a worker entry in WebKit.
self.onmessage = ({ data }: MessageEvent<Request>) => {
  try {
    let result;
    if (data.type === 'reconstruct') result = reconstructTrajectory(data.index, data.anchors, data.forward, data.backward, data.width, data.height);
    else if (data.anchor) {
      tracker = new PointTracker(); tracker.reset(data.frame, data.anchor, data.time);
      result = { x: data.anchor.x, y: data.anchor.y, confidence: 1 };
    } else { tracker.next(data.frame, data.time); result = tracker.observation(); }
    self.postMessage({ id: data.id, result });
  } catch (error) { self.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Analysis failed. Try a shorter excerpt.' }); }
};
