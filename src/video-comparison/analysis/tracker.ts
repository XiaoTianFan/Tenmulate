import jsfeat from 'jsfeat';
import type { Anchor } from './types';
export type PixelFrame = { width: number; height: number; rgba: Uint8ClampedArray };
type Image = { width: number; height: number; gray: Uint8Array; pyramid: any };
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
/** Local appearance plus optical-flow proposals. The seed template never learns
 * from uncertain predictions. A lost track stops until a user anchor resets it. */
export class PointTracker {
  private previous?: Image;
  private x = 0; private y = 0; private dx = 0; private dy = 0;
  private template = new Float32Array(225); private energy = 0; private stepX = 1; private stepY = 1;
  private lost = false;
  reset(frame: PixelFrame, anchor: Anchor) {
    const img = image(frame); this.previous = img; this.x = anchor.x * img.width; this.y = anchor.y * img.height; this.dx = this.dy = 0; this.lost = false;
    this.stepX = Math.max(0.6, Math.min(3, anchor.width * img.width / 14)); this.stepY = Math.max(0.6, Math.min(3, anchor.height * img.height / 14));
    let mean = 0, i = 0;
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) { const v = pixel(img, this.x + x * this.stepX, this.y + y * this.stepY); this.template[i++] = v; mean += v / 225; }
    this.energy = 0; for (let i = 0; i < 225; i++) { this.template[i] -= mean; this.energy += this.template[i] ** 2; }
  }
  next(frame: PixelFrame): { x: number; y: number; confidence: number } | null {
    if (this.lost || !this.previous || this.energy < 225 * 16) return null;
    const current = image(frame), previous = this.previous;
    if (current.width !== previous.width || current.height !== previous.height) throw new Error('Video dimensions changed during analysis.');
    const before = new Float32Array([this.x, this.y]), after = new Float32Array(2), back = new Float32Array(2), status = new Uint8Array(1), reverse = new Uint8Array(1);
    jsfeat.optical_flow_lk.track(previous.pyramid, current.pyramid, before, after, 1, 21, 30, status, .01, .0001);
    jsfeat.optical_flow_lk.track(current.pyramid, previous.pyramid, after, back, 1, 21, 30, reverse, .01, .0001);
    const flow = !!status[0] && !!reverse[0] && Math.hypot(back[0] - this.x, back[1] - this.y) < 1.5;
    const score = (cx: number, cy: number) => {
      if (cx - 7 * this.stepX < 1 || cy - 7 * this.stepY < 1 || cx + 7 * this.stepX >= current.width - 1 || cy + 7 * this.stepY >= current.height - 1) return -1;
      let sum = 0, square = 0, product = 0, i = 0;
      for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) { const v = pixel(current, cx + x * this.stepX, cy + y * this.stepY); sum += v; square += v * v; product += v * this.template[i++]; }
      const energy = square - sum * sum / 225;
      return energy < 225 * 9 ? -1 : product / Math.sqrt(this.energy * energy);
    };
    let best = { x: this.x + this.dx, y: this.y + this.dy, score: -1 };
    const candidates: typeof best[] = [];
    const consider = (x: number, y: number) => { const candidate = { x, y, score: score(x, y) }; candidates.push(candidate); if (candidate.score > best.score) best = candidate; };
    if (flow) consider(after[0], after[1]);
    const radius = Math.min(80, Math.max(48, Math.hypot(this.dx, this.dy) * 1.5 + 16)), cx = this.x + this.dx, cy = this.y + this.dy;
    for (let y = -radius; y <= radius; y += 3) for (let x = -radius; x <= radius; x += 3) consider(Math.round(cx + x), Math.round(cy + y));
    const coarse = { ...best };
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) consider(coarse.x + x, coarse.y + y);
    const nearby = Math.max(5, 4 * Math.max(this.stepX, this.stepY));
    let alternative = -1; for (const p of candidates) if (Math.hypot(p.x - best.x, p.y - best.y) > nearby) alternative = Math.max(alternative, p.score);
    if (best.score < .68 || best.score - alternative < .025) { this.lost = true; this.previous = undefined; return null; }
    this.dx = best.x - this.x; this.dy = best.y - this.y; this.x = best.x; this.y = best.y; this.previous = current;
    return { x: this.x / current.width, y: this.y / current.height, confidence: Math.min(1, Math.max(0, best.score)) };
  }
}
