import { expect, it } from 'vitest';
import { speedLabelVisible } from '../src/video-comparison/speed/exportLabel';
import type { ExportClip } from '../src/video-comparison/exportPlan';
import type { SpeedResult } from '../src/video-comparison/speed/types';
const clip: ExportClip = {
  id: 'x',
  name: 'x',
  file: new File([], 'x'),
  url: 'blob:x',
  width: 400,
  frame: 10,
  contact: 10,
  speed: 1,
  thumbnails: [],
  serveEstimate: { launchKph: 170 } as SpeedResult,
  index: {
    timestamps: Float64Array.from({ length: 601 }, (_, i) => i / 60),
    fps: 60,
    variable: false,
    end: 10 + 1 / 60
  }
};
it('shows an opted-in valid estimate for three output seconds after contact', () => {
  for (const rate of [0.25, 1, 2]) {
    expect(speedLabelVisible(clip, -0.001, rate)).toBe(false);
    expect(speedLabelVisible(clip, 0, rate)).toBe(true);
    expect(speedLabelVisible(clip, 2.99 * rate, rate)).toBe(true);
    expect(speedLabelVisible(clip, 3 * rate, rate)).toBe(false);
  }
  expect(speedLabelVisible({ ...clip, serveEstimate: undefined }, 0, 1)).toBe(false);
});
it('stops at the clip excerpt end rather than labelling held frames; honours per-clip speed', () => {
  const trimmed = { ...clip, trim: { start: 0, end: 70 }, speed: 2 };
  expect(speedLabelVisible(trimmed, 0.49, 1)).toBe(true);
  expect(speedLabelVisible(trimmed, 0.51, 1)).toBe(false);
  expect(speedLabelVisible({ ...trimmed, speed: 0.5 }, 1.9, 1)).toBe(true);
  expect(speedLabelVisible({ ...trimmed, speed: 0.5 }, 2.01, 1)).toBe(false);
});
