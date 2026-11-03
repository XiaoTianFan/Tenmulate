import jsfeat from 'jsfeat';
import type { TrackingPoint } from './trajectory';
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

type Template = { data: Float32Array; energy: number };
const weights = Float32Array.from({ length: 225 }, (_, i) => Math.exp(-((i % 15 - 7) ** 2 + (Math.floor(i / 15) - 7) ** 2) / 32));
const weightSum = weights.reduce((a, b) => a + b, 0);
type Blob = { x: number; y: number; area: number; contrast: number };
function colorBlobs(frame: PixelFrame, cx: number, cy: number, radius: number, color: number[]): Blob[] {
  const left = Math.max(0, Math.floor(cx - radius)), top = Math.max(0, Math.floor(cy - radius));
  const w = Math.min(frame.width, Math.ceil(cx + radius + 1)) - left, h = Math.min(frame.height, Math.ceil(cy + radius + 1)) - top;
  if (w < 1 || h < 1) return [];
  const mask = new Uint8Array(w * h), queue = new Int32Array(w * h), blobs: Blob[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = ((y + top) * frame.width + x + left) * 4, r = frame.rgba[p], g = frame.rgba[p + 1], b = frame.rgba[p + 2], total = r + g + b;
    if (total > 90 && Math.hypot(r / total - color[0], g / total - color[1], b / total - color[2]) < .14) mask[y * w + x] = 1;
  }
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    let head = 0, tail = 1, sx = 0, sy = 0; queue[0] = p; mask[p] = 0;
    while (head < tail) {
      const at = queue[head++], x = at % w, y = Math.floor(at / w); sx += x; sy += y;
      for (const next of [x > 0 ? at - 1 : -1, x + 1 < w ? at + 1 : -1, y > 0 ? at - w : -1, y + 1 < h ? at + w : -1]) if (next >= 0 && mask[next]) { mask[next] = 0; queue[tail++] = next; }
    }
    if (tail < 3 || tail > 2000) continue;
    const x = left + sx / tail, y = top + sy / tail, ring = Math.max(6, Math.sqrt(tail) * 1.2);
    let contrast = 0;
    for (let k = 0; k < 8; k++) { const c = chroma(frame, x + Math.cos(k * Math.PI / 4) * ring, y + Math.sin(k * Math.PI / 4) * ring); contrast += Math.hypot(...c.map((v, i) => v - color[i])) / 8; }
    blobs.push({ x, y, area: tail, contrast });
  }
  return blobs.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, 12);
}

/** Follow changing appearance with a fixed seed plus two guarded recent templates.
 * Flow, rotation/scale checks and color components propose matches in all motion
 * directions. Ambiguity is retained for the offline path selector, never learned. */
export class PointTracker {
  private previous?: Image;
  private x = 0; private y = 0; private vx = 0; private vy = 0; private time = 0; private clock = 0; private steps = 0; private misses = 0;
  private templates: Template[] = []; private stepX = 1; private stepY = 1;
  private color = [0, 0, 0]; private colorStrength = 0; private area = 0; private distinctColor = false;
  private matches: TrackingPoint[] = [];
  private capture(img: Image, x: number, y: number): Template {
    const data = new Float32Array(225); let mean = 0, energy = 0;
    for (let i = 0; i < 225; i++) { data[i] = pixel(img, x + (i % 15 - 7) * this.stepX, y + (Math.floor(i / 15) - 7) * this.stepY); mean += data[i] * weights[i] / weightSum; }
    for (let i = 0; i < 225; i++) { data[i] -= mean; energy += weights[i] * data[i] ** 2; }
    return { data, energy };
  }
  reset(frame: PixelFrame, anchor: Anchor, time = 0) {
    const img = image(frame); this.previous = img; this.x = anchor.x * img.width; this.y = anchor.y * img.height;
    this.vx = this.vy = this.steps = this.misses = 0; this.time = this.clock = time; this.matches = [];
    this.stepX = Math.max(.6, Math.min(3, anchor.width * img.width / 14)); this.stepY = Math.max(.6, Math.min(3, anchor.height * img.height / 14));
    this.color = chroma(img, this.x, this.y); this.colorStrength = Math.min(1, (Math.max(...this.color) - Math.min(...this.color)) * 4);
    this.templates = [this.capture(img, this.x, this.y)]; this.area = 0; this.distinctColor = false;
    if (this.colorStrength > .45) {
      const blob = colorBlobs(img, this.x, this.y, Math.max(16, 8 * Math.max(this.stepX, this.stepY)), this.color)[0];
      if (blob && Math.hypot(blob.x - this.x, blob.y - this.y) < 4) { this.area = blob.area; this.distinctColor = blob.contrast > .12; }
    }
  }
  observation(): TrackingPoint | null { return this.matches.length ? { ...this.matches[0], alternatives: this.matches.slice(1) } : null; }
  next(frame: PixelFrame, time = this.clock + 1 / 30): TrackingPoint | null {
    this.clock = time; this.matches = [];
    if (!this.previous || (this.templates.every(t => t.energy < weightSum * 16) && !this.distinctColor)) return null;
    const current = image(frame), previous = this.previous;
    if (current.width !== previous.width || current.height !== previous.height) throw new Error('Video dimensions changed during analysis.');
    const dt = time - this.time;
    if (!Number.isFinite(dt) || Math.abs(dt) < 1e-8) return null;
    const before = new Float32Array(18), after = new Float32Array(18), back = new Float32Array(18), status = new Uint8Array(9), reverse = new Uint8Array(9);
    for (let i = 0; i < 9; i++) { before[i * 2] = this.x + (i % 3 - 1) * this.stepX * 2; before[i * 2 + 1] = this.y + (Math.floor(i / 3) - 1) * this.stepY * 2; }
    jsfeat.optical_flow_lk.track(previous.pyramid, current.pyramid, before, after, 9, 21, 25, status, .01, .0001);
    jsfeat.optical_flow_lk.track(current.pyramid, previous.pyramid, after, back, 9, 21, 25, reverse, .01, .0001);
    const valid: number[] = [], dx: number[] = [], dy: number[] = [];
    for (let i = 0; i < 9; i++) if (status[i] && reverse[i] && Math.hypot(back[i * 2] - before[i * 2], back[i * 2 + 1] - before[i * 2 + 1]) < 1.2) { valid.push(i); dx.push(after[i * 2] - before[i * 2]); dy.push(after[i * 2 + 1] - before[i * 2 + 1]); }
    const proposals: { x: number; y: number; angle: number; scale: number }[] = [];
    if (valid.length >= 3) {
      proposals.push({ x: this.x + median(dx), y: this.y + median(dy), angle: 0, scale: 1 });
      const mean = (data: Float32Array, axis: number) => valid.reduce((sum, i) => sum + data[i * 2 + axis], 0) / valid.length;
      const ax = mean(before, 0), ay = mean(before, 1), bx = mean(after, 0), by = mean(after, 1);
      let real = 0, imaginary = 0, norm = 0;
      for (const i of valid) { const x = before[i * 2] - ax, y = before[i * 2 + 1] - ay, u = after[i * 2] - bx, v = after[i * 2 + 1] - by; real += x * u + y * v; imaginary += x * v - y * u; norm += x * x + y * y; }
      const a = real / norm, b = imaginary / norm, scale = Math.hypot(a, b);
      if (scale > .65 && scale < 1.5 && valid.filter(i => Math.hypot(bx + a * (before[i * 2] - ax) - b * (before[i * 2 + 1] - ay) - after[i * 2], by + b * (before[i * 2] - ax) + a * (before[i * 2 + 1] - ay) - after[i * 2 + 1]) < 2).length >= valid.length * .7) {
        proposals.push({ x: bx + a * (this.x - ax) - b * (this.y - ay), y: by + b * (this.x - ax) + a * (this.y - ay), angle: Math.atan2(b, a), scale });
      }
    }
    const cx = Math.max(0, Math.min(frame.width - 1, this.x + this.vx * dt)), cy = Math.max(0, Math.min(frame.height - 1, this.y + this.vy * dt));
    const correlation = (x: number, y: number, angle: number, scale: number) => {
      const cos = Math.cos(angle) * scale, sin = Math.sin(angle) * scale, products = [0, 0, 0]; let sum = 0, square = 0;
      for (let i = 0; i < 225; i++) {
        const dx = (i % 15 - 7) * this.stepX, dy = (Math.floor(i / 15) - 7) * this.stepY, v = pixel(current, x + cos * dx - sin * dy, y + sin * dx + cos * dy), w = weights[i];
        sum += v * w; square += v * v * w;
        for (let t = 0; t < this.templates.length; t++) products[t] += w * v * this.templates[t].data[i];
      }
      const energy = square - sum * sum / weightSum;
      if (energy < weightSum * 9) return -1;
      return Math.max(...this.templates.map((t, i) => t.energy < weightSum * 16 ? -1 : products[i] / Math.sqrt(t.energy * energy) * (i ? .99 : 1)));
    };
    type Candidate = { x: number; y: number; score: number; appearance: number; verified: boolean };
    const candidates: Candidate[] = [];
    const radius = Math.min(128, Math.max(this.steps < 2 ? 96 : 36, Math.hypot(this.vx * dt, this.vy * dt) * 1.2 + this.misses * 8 + 16));
    const consider = (x: number, y: number, angle = 0, scale = 1, blob?: Blob) => {
      if (x < 1 || y < 1 || x >= frame.width - 1 || y >= frame.height - 1) return;
      const color = chroma(current, x, y), colorDistance = Math.hypot(...color.map((v, i) => v - this.color[i]));
      if (this.colorStrength > .4 && colorDistance > .25) return;
      const ncc = correlation(x, y, angle, scale), areaRatio = blob && this.area ? blob.area / this.area : 0;
      const shape = areaRatio > .3 && areaRatio < 3 ? Math.exp(-Math.abs(Math.log(areaRatio))) : 0;
      const colorEvidence = blob && this.distinctColor && blob.contrast > .12 && colorDistance < .12 && shape > .3 ? .74 + .15 * shape : -1;
      const appearance = Math.max(ncc, colorEvidence); if (appearance < .58) return;
      const flow = proposals.some(p => Math.hypot(x - p.x, y - p.y) < 2.5);
      const score = appearance - .35 * this.colorStrength * colorDistance - (this.steps > 1 ? .025 * Math.min(1, Math.hypot(x - cx, y - cy) / radius) : 0);
      candidates.push({ x, y, score, appearance, verified: (flow && ncc > .8) || colorEvidence > .83 });
    };
    for (const p of proposals) { consider(p.x, p.y); consider(p.x, p.y, p.angle, p.scale); }
    consider(cx, cy); consider(this.x, this.y);
    if (this.area) for (const blob of colorBlobs(frame, (cx + this.x) / 2, (cy + this.y) / 2, Math.min(180, radius + Math.hypot(cx - this.x, cy - this.y) / 2), this.color)) consider(blob.x, blob.y, 0, 1, blob);
    // Search around both the last observation and prediction; a reversal must not
    // fall outside a search region that has already moved in the old direction.
    for (const [center, [ox, oy]] of [[cx, cy], [this.x, this.y]].entries()) {
      if (center === 1 && Math.hypot(cx - this.x, cy - this.y) < radius / 2) continue;
      for (let y = -radius; y <= radius; y += 3) for (let x = -radius; x <= radius; x += 3) consider(Math.round(ox + x), Math.round(oy + y));
    }
    const peaks: Candidate[] = [];
    for (const c of candidates.sort((a, b) => b.score - a.score)) if (!peaks.some(p => Math.hypot(c.x - p.x, c.y - p.y) < 5)) { peaks.push(c); if (peaks.length === 4) break; }
    // Expensive appearance transforms are restricted to a few spatial proposals.
    for (const p of [...peaks, ...proposals].slice(0, 6)) {
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) consider(p.x + x, p.y + y);
      if ((peaks[0]?.appearance ?? 0) < .92) for (const angle of [-.45, -.22, .22, .45]) for (const scale of [.85, 1, 1.18]) consider(p.x, p.y, angle, scale);
    }
    const ranked: Candidate[] = [];
    for (const c of candidates.sort((a, b) => b.score - a.score)) if (!ranked.some(p => Math.hypot(c.x - p.x, c.y - p.y) < 5)) { ranked.push(c); if (ranked.length === 4) break; }
    this.matches = ranked.map(p => ({ x: p.x / frame.width, y: p.y / frame.height, confidence: Math.max(0, Math.min(1, p.score)), verified: p.verified }));
    const best = ranked[0];
    if (!best || best.appearance < .68 || (ranked[1] && best.score - ranked[1].score < .015)) { this.misses++; return null; }
    const canLearn = this.misses === 0 && best.appearance > .84 && best.verified;
    this.vx = (best.x - this.x) / dt; this.vy = (best.y - this.y) / dt;
    this.x = best.x; this.y = best.y; this.previous = current; this.time = time; this.steps++; this.misses = 0;
    if (canLearn) {
      const recent = this.capture(current, best.x, best.y);
      if (recent.energy >= weightSum * 16) this.templates = [this.templates[0], recent, ...(this.steps % 5 === 0 ? this.templates.slice(1, 2) : this.templates.slice(2, 3))];
    }
    return this.matches[0];
  }
}
