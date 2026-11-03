import { expect, it } from 'vitest';
import { PointTracker, type PixelFrame } from '../src/video-comparison/analysis/tracker';
import { reconstructTrajectory, type TrackingPass } from '../src/video-comparison/analysis/trajectory';
import { createFrameIndex } from '../src/video-comparison/timeline';
import { sampleAt, ESTIMATED, type Anchor } from '../src/video-comparison/analysis/types';
const width = 320, height = 240, count = 75;
const index = createFrameIndex(Array.from({ length: count }, (_, i) => ({ timestamp: i / 60, duration: 1 / 60 })));
const center = (i: number) => ({ x: 160 + 62 * Math.sin(i / (count - 1) * Math.PI * 2), y: 120 + 38 * Math.sin(i / (count - 1) * Math.PI * 4) });
function frame(i: number, rotate: boolean): PixelFrame {
  const rgba = new Uint8ClampedArray(width * height * 4), c = center(i), angle = rotate ? i * .075 : 0, cos = Math.cos(angle), sin = Math.sin(angle);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = (y * width + x) * 4, noise = 35 + (x * 13 + y * 7) % 21;
    rgba.set([noise, noise + 5, noise, 255], at);
    const dx = cos * (x - c.x) + sin * (y - c.y), dy = -sin * (x - c.x) + cos * (y - c.y);
    if (rotate ? dx * dx / 81 + dy * dy / 196 < 1 : dx * dx + dy * dy < 20) {
      const value = 100 + ((Math.floor(dx + 20) * 37 + Math.floor(dy + 20) * 17) % 100);
      rgba.set(rotate ? [value, value, value, 255] : [190, 230, 30, 255], at);
    }
  }
  return { width, height, rgba };
}
for (const rotate of [false, true]) it(`tracks ${rotate ? 'a rotating textured region' : 'a ball'} through a full figure-eight without intermediate corrections`, () => {
  const frames = Array.from({ length: count }, (_, i) => frame(i, rotate));
  const anchors: Anchor[] = [0, count - 1].map((f, i) => ({ frame: f, x: center(f).x / width, y: center(f).y / height, width: rotate ? .07 : .035, height: rotate ? .12 : .045, role: i ? 'end' : 'start' }));
  const forward: TrackingPass = Array(count).fill(null), backward: TrackingPass = Array(count).fill(null);
  for (const direction of [1, -1]) {
    const tracker = new PointTracker(), a = anchors[direction === 1 ? 0 : 1], pass = direction === 1 ? forward : backward;
    tracker.reset(frames[a.frame], a, index.timestamps[a.frame]); pass[a.frame] = { ...a, confidence: 1 };
    for (let i = a.frame + direction; i >= 0 && i < count; i += direction) { tracker.next(frames[i], index.timestamps[i]); pass[i] = tracker.observation(); }
  }
  const result = reconstructTrajectory(index, anchors, forward, backward, width, height);
  const errors = Array.from({ length: count }, (_, i) => Math.hypot(sampleAt(result, i)!.x * width - center(i).x, sampleAt(result, i)!.y * height - center(i).y));
  expect(errors.reduce((a, b) => a + b, 0) / count).toBeLessThan(2);
  expect(Math.max(...errors)).toBeLessThan(5);
  expect(Array.from(result.states).filter(state => state === ESTIMATED).length).toBeLessThan(count * .15);
}, 30000);
it('keeps a blurred colored ball on a curved path over green texture through a short occlusion', () => {
  const frames = Array.from({ length: count }, (_, f) => {
    const rgba = new Uint8ClampedArray(width * height * 4), c = center(f), a = center(Math.max(0, f - 1)), b = center(Math.min(count - 1, f + 1));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4, noise = (x * 13 + y * 7) % 31;
      rgba.set([25 + noise, 60 + noise, 20 + noise, 255], at);
      if (Math.hypot(x - 60, y - 55) < 4 || Math.hypot(x - 270, y - 190) < 4) rgba.set([160, 235, 20, 255], at);
      if (f >= 35 && f <= 38) continue;
      let exposure = 0;
      for (const t of [-.2, 0, .2]) if ((x - c.x - (b.x - a.x) * t) ** 2 + (y - c.y - (b.y - a.y) * t) ** 2 < 20) exposure += 1 / 3;
      if (exposure) { const rgb = [160 + 10 * Math.cos(f), 235 + 10 * Math.sin(f), 20]; for (let k = 0; k < 3; k++) rgba[at + k] = rgba[at + k] * (1 - exposure) + rgb[k] * exposure; }
    }
    return { width, height, rgba };
  });
  const anchors: Anchor[] = [0, count - 1].map((f, i) => ({ frame: f, x: center(f).x / width, y: center(f).y / height, width: .04, height: .05, role: i ? 'end' : 'start' }));
  const fwd: TrackingPass = Array(count).fill(null), back: TrackingPass = Array(count).fill(null);
  for (const direction of [1, -1]) {
    const tracker = new PointTracker(), anchor = anchors[direction === 1 ? 0 : 1], pass = direction === 1 ? fwd : back;
    tracker.reset(frames[anchor.frame], anchor, index.timestamps[anchor.frame]); pass[anchor.frame] = { ...anchor, confidence: 1 };
    for (let f = anchor.frame + direction; f >= 0 && f < count; f += direction) { tracker.next(frames[f], index.timestamps[f]); pass[f] = tracker.observation(); }
  }
  const r = reconstructTrajectory(index, anchors, fwd, back, width, height);
  const errors = Array.from({ length: count }, (_, i) => Math.hypot(sampleAt(r, i)!.x * width - center(i).x, sampleAt(r, i)!.y * height - center(i).y));
  expect(Math.max(...errors)).toBeLessThan(5);
  expect(errors.reduce((a, b) => a + b, 0) / count).toBeLessThan(2);
  expect(Array.from(r.states).filter(s => s === ESTIMATED).length).toBeLessThan(count * .2);
}, 30000);
