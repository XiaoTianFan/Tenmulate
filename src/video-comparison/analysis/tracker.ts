import jsfeat from 'jsfeat';
import type { Anchor } from './types';
export type PixelFrame = { width: number; height: number; rgba: Uint8ClampedArray };
type Image = PixelFrame & { gray: Uint8Array; pyramid: any };
function image(frame: PixelFrame): Image {
  const pyramid = new jsfeat.pyramid_t(4); pyramid.allocate(frame.width, frame.height, jsfeat.U8_t | jsfeat.C1_t);
  jsfeat.imgproc.grayscale(frame.rgba, frame.width, frame.height, pyramid.data[0]); pyramid.build(pyramid.data[0], true);
  return { ...frame, gray: pyramid.data[0].data, pyramid };
}
function pixel(image: Image, x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), dx = x - ix, dy = y - iy;
  if (ix < 0 || iy < 0 || ix + 1 >= image.width || iy + 1 >= image.height) return 0;
  const p = iy * image.width + ix, a = image.gray;
  return a[p] * (1 - dx) * (1 - dy) + a[p + 1] * dx * (1 - dy) + a[p + image.width] * (1 - dx) * dy + a[p + image.width + 1] * dx * dy;
}
function chroma(image: PixelFrame, x: number, y: number) {
  let r = 0, g = 0, b = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const ix = Math.max(0, Math.min(image.width - 1, Math.round(x + dx))), iy = Math.max(0, Math.min(image.height - 1, Math.round(y + dy))), i = (iy * image.width + ix) * 4;
    r += image.rgba[i]; g += image.rgba[i + 1]; b += image.rgba[i + 2];
  }
  const sum = r + g + b || 1; return [r / sum, g / sum, b / sum];
}
const median = (values: number[]) => { values.sort((a, b) => a - b); return values[Math.floor(values.length / 2)]; };

/** Fixed appearance prevents learning a distractor. Multi-point round-trip flow,
 * chroma and timestamp-aware prediction rank candidates. Short losses can recover;
 * unsupported positions are null until the offline, anchored reconstruction. */
export class PointTracker {
  private previous?: Image;
  private x = 0; private y = 0; private vx = 0; private vy = 0; private time = 0; private clock = 0; private steps = 0; private misses = 0;
  private template = new Float32Array(225); private energy = 0; private stepX = 1; private stepY = 1;
  private color = [0, 0, 0]; private colorStrength = 0;
  reset(frame: PixelFrame, anchor: Anchor, time = 0) {
    const img = image(frame); this.previous = img; this.x = anchor.x * img.width; this.y = anchor.y * img.height;
    this.vx = this.vy = this.steps = this.misses = 0; this.time = this.clock = time;
    this.stepX = Math.max(.6, Math.min(3, anchor.width * img.width / 14)); this.stepY = Math.max(.6, Math.min(3, anchor.height * img.height / 14));
    this.color = chroma(img, this.x, this.y); this.colorStrength = Math.min(1, (Math.max(...this.color) - Math.min(...this.color)) * 4);
    let mean = 0, i = 0;
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) { const v = pixel(img, this.x + x * this.stepX, this.y + y * this.stepY); this.template[i++] = v; mean += v / 225; }
    this.energy = 0; for (let i = 0; i < 225; i++) { this.template[i] -= mean; this.energy += this.template[i] ** 2; }
  }
  next(frame: PixelFrame, time = this.clock + 1 / 30, impact = false): { x: number; y: number; confidence: number } | null {
    this.clock = time;
    if (!this.previous || this.energy < 225 * 16) return null;
    const current = image(frame), previous = this.previous;
    if (current.width !== previous.width || current.height !== previous.height) throw new Error('Video dimensions changed during analysis.');
    const dt = time - this.time;
    if (!Number.isFinite(dt) || Math.abs(dt) < 1e-8) return null;
    const before = new Float32Array(18), after = new Float32Array(18), back = new Float32Array(18), status = new Uint8Array(9), reverse = new Uint8Array(9);
    for (let i = 0; i < 9; i++) { before[i * 2] = this.x + (i % 3 - 1) * this.stepX * 2; before[i * 2 + 1] = this.y + (Math.floor(i / 3) - 1) * this.stepY * 2; }
    jsfeat.optical_flow_lk.track(previous.pyramid, current.pyramid, before, after, 9, 21, 25, status, .01, .0001);
    jsfeat.optical_flow_lk.track(current.pyramid, previous.pyramid, after, back, 9, 21, 25, reverse, .01, .0001);
    const dx: number[] = [], dy: number[] = [];
    for (let i = 0; i < 9; i++) if (status[i] && reverse[i] && Math.hypot(back[i * 2] - before[i * 2], back[i * 2 + 1] - before[i * 2 + 1]) < 1.2) {
      dx.push(after[i * 2] - before[i * 2]); dy.push(after[i * 2 + 1] - before[i * 2 + 1]);
    }
    const flowX = dx.length ? median(dx) : 0, flowY = dy.length ? median(dy) : 0;
    const flow = dx.length >= 3 && median(dx.map(x => Math.abs(x - flowX))) + median(dy.map(y => Math.abs(y - flowY))) < 2;
    const cx = this.x + this.vx * dt, cy = this.y + this.vy * dt;
    const correlation = (x: number, y: number) => {
      if (x - 7 * this.stepX < 1 || y - 7 * this.stepY < 1 || x + 7 * this.stepX >= current.width - 1 || y + 7 * this.stepY >= current.height - 1) return -1;
      let sum = 0, square = 0, product = 0, i = 0;
      for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) { const v = pixel(current, x + dx * this.stepX, y + dy * this.stepY); sum += v; square += v * v; product += v * this.template[i++]; }
      const energy = square - sum * sum / 225; return energy < 225 * 9 ? -1 : product / Math.sqrt(this.energy * energy);
    };
    type Candidate = { x: number; y: number; score: number; appearance: number };
    let best: Candidate = { x: cx, y: cy, score: -Infinity, appearance: -1 }; const candidates: Candidate[] = [];
    const radius = Math.min(128, Math.max(this.steps < 2 || impact ? 96 : 24, Math.hypot(this.vx * dt, this.vy * dt) * .8 + this.misses * 8 + 16));
    const consider = (x: number, y: number) => {
      const appearance = correlation(x, y); if (appearance < .55) return;
      const color = chroma(current, x, y), colorDistance = Math.hypot(...color.map((v, i) => v - this.color[i]));
      if (this.colorStrength > .4 && colorDistance > .22) return;
      const penalty = this.steps > 1 && !impact ? .08 * Math.min(1, Math.hypot(x - cx, y - cy) / Math.max(12, radius)) : 0;
      const score = appearance - .6 * this.colorStrength * colorDistance - penalty;
      const candidate = { x, y, score, appearance }; candidates.push(candidate); if (score > best.score) best = candidate;
    };
    if (flow) consider(this.x + flowX, this.y + flowY);
    consider(cx, cy);
    for (let y = -radius; y <= radius; y += 3) for (let x = -radius; x <= radius; x += 3) consider(Math.round(cx + x), Math.round(cy + y));
    const coarse = { ...best };
    if (Number.isFinite(coarse.score)) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) consider(coarse.x + x, coarse.y + y);
    const nearby = Math.max(5, 4 * Math.max(this.stepX, this.stepY)); let alternative = -Infinity;
    for (const candidate of candidates) if (Math.hypot(candidate.x - best.x, candidate.y - best.y) > nearby) alternative = Math.max(alternative, candidate.score);
    if (best.appearance < .7 || best.score - alternative < .02) { this.misses++; return null; }
    this.vx = (best.x - this.x) / dt; this.vy = (best.y - this.y) / dt;
    this.x = best.x; this.y = best.y; this.previous = current; this.time = time; this.steps++; this.misses = 0;
    return { x: this.x / current.width, y: this.y / current.height, confidence: Math.min(1, Math.max(0, best.score)) };
  }
}
