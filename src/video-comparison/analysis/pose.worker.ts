import { PoseRuntime } from './poseRuntime';
import type { PixelFrame } from './tracker';
import type { FrameIndex } from '../timeline';
import type { MotionSeries } from './types';
import { stabilizePose } from './stabilizePose';
let pose: PoseRuntime | undefined;
// This worker is constructed only for pose jobs. Keep its runtime imports static:
// no model chunk may import an entry module and replace this message handler.
self.onmessage = async ({ data }: MessageEvent<{ id: number; type: 'initPose' | 'pose' | 'finishPose'; frame?: PixelFrame; time?: number; series?: MotionSeries; index?: FrameIndex; frames?: number[] }>) => {
  try {
    let result;
    if (data.type === 'initPose') {
      pose = new PoseRuntime();
      await pose.init(progress => self.postMessage({ id: data.id, progress })); result = true;
    } else if (data.type === 'finishPose') {
      if (!data.series || !data.index || !data.frames) throw new Error('Pose observations are missing.');
      result = stabilizePose(data.series, data.index, data.frames);
    } else {
      if (!pose || !data.frame) throw new Error('Pose model is not ready.');
      result = await pose.detect(data.frame, data.time ?? 0);
    }
    self.postMessage({ id: data.id, result });
  } catch (error) { self.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Analysis failed. Try a shorter excerpt.' }); }
};
