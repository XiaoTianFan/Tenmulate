import type { FrameIndex } from './timeline';

export type ComparisonClip = {
  id: string;
  name: string;
  url: string;
  index?: FrameIndex;
  contact: number | null;
  frame: number;
  speed: number;
  width: number;
  thumbnails: string[];
  error?: string;
};
