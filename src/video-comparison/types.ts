import type { FrameIndex } from './timeline';
import type { CropRect } from './crop';
import type { ClipMotion } from './analysis/types';
import type { ServeSetup } from './speed/types';

export type ComparisonClip = {
  id: string;
  name: string;
  url: string;
  file: File;
  index?: FrameIndex;
  contact: number | null;
  frame: number;
  speed: number;
  mirrored?: boolean;
  trim?: { start: number; end: number };
  crop?: CropRect;
  width: number;
  thumbnails: string[];
  error?: string;
  motion?: ClipMotion;
  serve?: ServeSetup;
};
