import { normalizeCrop, type CropRect } from '../crop';

const TORSO = [5, 6, 11, 12];
type Body = { x: number; y: number; scale: number; count: number; score: number };
/** Geometry is in source pixels, including on portrait videos. */
export function poseBody(values: Float32Array, width: number, height: number): Body | undefined {
  const seen = (p: number) => values[p * 3 + 2] >= .35 && Number.isFinite(values[p * 3] + values[p * 3 + 1]);
  const shoulders = [5, 6].filter(seen), hips = [11, 12].filter(seen);
  if (!shoulders.length || !hips.length) return;
  const mean = (points: number[], axis: number) => points.reduce((sum, p) => sum + values[p * 3 + axis], 0) / points.length;
  const sx = mean(shoulders, 0) * width, sy = mean(shoulders, 1) * height;
  const hx = mean(hips, 0) * width, hy = mean(hips, 1) * height;
  let count = 0, score = 0;
  for (let p = 0; p < 17; p++) if (seen(p)) { count++; score += values[p * 3 + 2]; }
  return { x: (sx + hx) / 2, y: (sy + hy) / 2, scale: Math.max(12, Math.hypot(sx - hx, sy - hy)), count, score: score / 17 };
}

/** Full-frame detections initialize automatic recovery regions.
 * Only accepted torso detections update the search and velocity. */
export class PoseFollower {
  private crop: CropRect;
  private body?: Body;
  private lastTime = 0;
  private vx = 0;
  private vy = 0;
  private misses = 0;
  constructor(private width: number, private height: number) { this.crop = normalizeCrop(); }
  private rectangle(x: number, y: number, w: number, h: number): CropRect {
    return normalizeCrop({ x: (x - w / 2) / this.width, y: (y - h / 2) / this.height, width: w / this.width, height: h / this.height });
  }
  private prediction(time: number) {
    const dt = Math.max(-.2, Math.min(.2, time - this.lastTime));
    return { x: (this.body?.x ?? (this.crop.x + this.crop.width / 2) * this.width) + this.vx * dt,
      y: (this.body?.y ?? (this.crop.y + this.crop.height / 2) * this.height) + this.vy * dt };
  }
  regions(time: number): CropRect[] {
    const dt = this.body ? Math.max(-.2, Math.min(.2, time - this.lastTime)) : 0;
    const padding = 1 + Math.min(.8, this.misses * .2);
    const primary = this.rectangle((this.crop.x + this.crop.width / 2) * this.width + this.vx * dt,
      (this.crop.y + this.crop.height / 2) * this.height + this.vy * dt,
      this.crop.width * this.width * padding + Math.abs(this.vx * dt), this.crop.height * this.height * padding + Math.abs(this.vy * dt));
    const expanded = this.rectangle((primary.x + primary.width / 2) * this.width, (primary.y + primary.height / 2) * this.height, primary.width * this.width * 1.6, primary.height * this.height * 1.6);
    return [primary, expanded, { x: 0, y: 0, width: 1, height: 1 }].filter((r, i, all) => !all.slice(0, i).some(a => Math.abs(a.x - r.x) + Math.abs(a.y - r.y) + Math.abs(a.width - r.width) + Math.abs(a.height - r.height) < .01));
  }
  score(values: Float32Array, time: number): number {
    const body = poseBody(values, this.width, this.height);
    if (!body) {
      // A cropped/blurred hip should not erase confidently visible shoulders.
      // Preserve a plausible partial pose, but never move the trusted crop from it.
      if (!this.body) return -1;
      const predicted = this.prediction(time), torso = TORSO.filter(p => values[p * 3 + 2] >= .45);
      if (torso.length < 2 || torso.some(p => Math.hypot(values[p * 3] * this.width - predicted.x, values[p * 3 + 1] * this.height - predicted.y) > this.body!.scale * 1.8)) return -1;
      let score = 0;
      for (let p = 0; p < 17; p++) if (values[p * 3 + 2] >= .35) score += values[p * 3 + 2];
      return score / 17 * .8;
    }
    if (this.body) {
      const predicted = this.prediction(time), elapsed = Math.min(.25, Math.abs(time - this.lastTime));
      // Do not reacquire a distant bystander after a long occlusion.
      if (Math.hypot(body.x - predicted.x, body.y - predicted.y) > this.body.scale * (1.5 + elapsed * 5) || body.scale / this.body.scale > 2.2 || body.scale / this.body.scale < .45) return -1;
    }
    return body.score;
  }
  sufficient(values: Float32Array, crop: CropRect): boolean {
    const body = poseBody(values, this.width, this.height);
    if (!body || body.count < 13 || body.score < .55) return false;
    for (let p = 0; p < 17; p++) if (values[p * 3 + 2] >= .35) {
      const x = values[p * 3], y = values[p * 3 + 1];
      if ((crop.x > .01 && x - crop.x < crop.width * .06) || (crop.x + crop.width < .99 && crop.x + crop.width - x < crop.width * .06) || (crop.y > .01 && y - crop.y < crop.height * .06) || (crop.y + crop.height < .99 && crop.y + crop.height - y < crop.height * .06)) return false;
    }
    return true;
  }
  accept(values: Float32Array | undefined, time: number) {
    const body = values && poseBody(values, this.width, this.height);
    if (!body || !values || this.score(values, time) < 0) { this.misses++; return; }
    const dt = time - this.lastTime;
    if (this.body && Math.abs(dt) > 1e-5) {
      const limit = body.scale * 8;
      this.vx = .5 * this.vx + .5 * Math.max(-limit, Math.min(limit, (body.x - this.body.x) / dt));
      this.vy = .5 * this.vy + .5 * Math.max(-limit, Math.min(limit, (body.y - this.body.y) / dt));
    }
    let radius = body.scale * 2.5;
    for (let p = 0; p < 17; p++) if (values[p * 3 + 2] >= .35 || TORSO.includes(p) && values[p * 3 + 2] >= .25) radius = Math.max(radius, Math.abs(values[p * 3] * this.width - body.x) * 1.2, Math.abs(values[p * 3 + 1] * this.height - body.y) * 1.2);
    const side = 2 * radius;
    this.crop = this.rectangle(body.x, body.y, Math.max(side, this.body ? this.crop.width * this.width * .9 : 0), Math.max(side, this.body ? this.crop.height * this.height * .9 : 0));
    this.body = body; this.lastTime = time; this.misses = 0;
  }
}
