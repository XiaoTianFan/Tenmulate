import { PoseRuntime } from './poseRuntime';
import type { PixelFrame } from './tracker';
import type { CropRect } from '../crop';
let pose: PoseRuntime | undefined;
// This worker is constructed only for pose jobs. Keep its runtime imports static:
// no model chunk may import an entry module and replace this message handler.
self.onmessage = async ({ data }: MessageEvent<{ id: number; type: 'initPose' | 'pose'; frame?: PixelFrame; region?: CropRect }>) => {
  try {
    let result;
    if (data.type === 'initPose') {
      pose = new PoseRuntime();
      await pose.init(progress => self.postMessage({ id: data.id, progress })); result = true;
    } else {
      if (!pose || !data.frame) throw new Error('Pose model is not ready.');
      result = await pose.detect(data.frame, data.region);
    }
    self.postMessage({ id: data.id, result });
  } catch (error) { self.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Analysis failed. Try a shorter excerpt.' }); }
};
