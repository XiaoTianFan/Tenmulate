import type { FrameIndex } from './timeline';

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
  width: number;
  thumbnails: string[];
  error?: string;
};
