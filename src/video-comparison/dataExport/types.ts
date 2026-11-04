import type { ComparisonClip } from '../types';
import type { FrameIndex } from '../timeline';
import type { Camera, MeasurementIssue, SpeedResult } from '../speed/types';
export type DataSection = 'motion-analysis' | 'motion-plots' | 'serve-speed';
/** Deliberately excludes File, blob URLs and thumbnail images. */
export type DataClip = Pick<
  ComparisonClip,
  'id' | 'name' | 'contact' | 'speed' | 'trim' | 'crop' | 'mirrored' | 'motion' | 'serve'
> & {
  index: FrameIndex;
  sourceWidth: number;
  sourceHeight: number;
};
export type DataExportRequest = {
  section: DataSection;
  clip: DataClip;
  result?: SpeedResult;
  calibration?: Camera;
  issue?: MeasurementIssue;
};
