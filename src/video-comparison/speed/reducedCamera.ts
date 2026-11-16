import { leastSquares, project } from './projective';
import type { CameraControl } from './cameraFit';
import type { Point } from './types';

/** Metric pinhole model for sparse court evidence: square pixels, zero skew and
 * an assumed optical centre. Parameters are camera position, yaw/pitch/roll and
 * log focal length (pixels). This is deliberately separate from the full DLT fit. */
export function reducedMatrix(a: number[], width: number, height: number, centre: Point) {
  const [x, y, z, yaw, pitch, roll, logF] = a;
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    cr = Math.cos(roll),
    sr = Math.sin(roll),
    f = Math.exp(logF);
  const right = [cy, -sy, 0],
    down = [-sy * sp, -cy * sp, -cp],
    forward = [sy * cp, cy * cp, -sp];
  const rotation = [
    right.map((v, i) => cr * v + sr * down[i]),
    down.map((v, i) => cr * v - sr * right[i]),
    forward
  ];
  const r = rotation.map((row) => [...row, -row[0] * x - row[1] * y - row[2] * z]);
  return [
    r[0].map((v, i) => (f / width) * v + centre.x * r[2][i]),
    r[1].map((v, i) => (f / height) * v + centre.y * r[2][i]),
    r[2]
  ];
}

type Fit = { p: number[][]; parameters: number[]; score: number };
export function fitReducedCamera(
  controls: CameraControl[],
  width: number,
  height: number,
  centre: Point = { x: 0.5, y: 0.5 },
  seed?: number[]
): Fit[] {
  const diagonal = Math.hypot(width, height);
  const residuals = (a: number[]) => {
    if (
      !a.every(Number.isFinite) ||
      a[1] >= 5.4 ||
      a[1] < -200 ||
      Math.abs(a[0]) > 100 ||
      a[2] < 0.3 ||
      a[2] > 60 ||
      Math.abs(a[4]) > 1.5 ||
      Math.exp(a[6]) < diagonal * 0.12 ||
      Math.exp(a[6]) > diagonal * 20
    )
      throw new Error('Invalid camera');
    const p = reducedMatrix(a, width, height, centre);
    return controls.flatMap((c) => {
      const q = project(p, c.xyz);
      return [((q.x - c.point.x) * width) / c.sigma, ((q.y - c.point.y) * height) / c.sigma];
    });
  };
  const weights = (r: number[]) =>
    r.map((_, i) => Math.sqrt(Math.min(1, 2.5 / (Math.hypot(r[i - (i % 2)], r[i - (i % 2) + 1]) || 1))));
  const score = (r: number[]) => {
    let loss = 0;
    for (let i = 0; i < r.length; i += 2) {
      const d = Math.hypot(r[i], r[i + 1]);
      loss += d <= 2.5 ? d * d : 5 * d - 6.25;
    }
    return loss;
  };
  const jacobian = (a: number[], r: number[]) => {
    const columns = a.map((v, j) => {
      const step = 1e-5 * Math.max(1, Math.abs(v));
      const next = [...a];
      next[j] += step;
      return residuals(next).map((n, i) => (n - r[i]) / step);
    });
    return r.map((_, i) => columns.map((c) => c[i]));
  };
  const refine = (initial: number[]): Fit | undefined => {
    try {
      let a = [...initial],
        r = residuals(a),
        loss = score(r),
        damping = 1e-3;
      for (let iteration = 0; iteration < 80; iteration++) {
        const w = weights(r),
          j = jacobian(a, r).map((row, i) => row.map((v) => v * w[i]));
        const norms = a.map((_, k) => Math.hypot(...j.map((row) => row[k])) || 1);
        let improvement = 0;
        for (let attempt = 0; attempt < 8; attempt++) {
          const regularizer = norms.map((n, k) => a.map((_, l) => (k === l ? n * Math.sqrt(damping) : 0)));
          const delta = leastSquares(
            [...j, ...regularizer],
            [...r.map((v, i) => -v * w[i]), ...a.map(() => 0)]
          );
          const trial = a.map((v, i) => v + delta[i]);
          try {
            const next = residuals(trial),
              nextLoss = score(next);
            if (nextLoss < loss) {
              improvement = loss - nextLoss;
              a = trial;
              r = next;
              loss = nextLoss;
              damping = Math.max(1e-9, damping / 3);
              break;
            }
          } catch {
            /* Reject invalid trial geometry. */
          }
          damping *= 10;
        }
        if (improvement < 1e-9 * (1 + loss)) break;
      }
      // Damping must not disguise missing independent information.
      leastSquares(
        jacobian(a, r),
        r.map(() => 0)
      );
      return { p: reducedMatrix(a, width, height, centre), parameters: a, score: loss };
    } catch {
      return undefined;
    }
  };
  const top = controls.find((c) => c.mark === 'netCenter' && c.xyz[2] > 0)!,
    foot = controls.find((c) => c.mark === 'netCenter' && c.xyz[2] === 0)!;
  const dx = (top.point.x - foot.point.x) * width,
    dy = (top.point.y - foot.point.y) * height;
  const roll = Math.atan2(-dx, -dy),
    starts: number[][] = [];
  if (seed) starts.push(seed);
  else
    for (const x of [-8, 0, 8])
      for (const y of [-5, -18, -45])
        for (const z of [2, 8, 18]) {
          const distance = Math.hypot(x, 11.885 - y, z);
          const f = Math.max(diagonal * 0.2, (Math.hypot(dx, dy) * distance) / 0.914);
          const u = (foot.point.x - centre.x) * width,
            v = (foot.point.y - centre.y) * height;
          starts.push([
            x,
            y,
            z,
            Math.atan2(-x, 11.885 - y) - Math.atan2(u, f),
            Math.atan2(z, Math.hypot(x, 11.885 - y)) - Math.atan2(v, f),
            roll,
            Math.log(f)
          ]);
        }
  const fits = starts
    .map(refine)
    .filter((f): f is Fit => !!f)
    .sort((a, b) => a.score - b.score);
  // Retain different poses, not multiple optimizer starts at the same solution.
  return fits.filter(
    (f, i) =>
      !fits
        .slice(0, i)
        .some(
          (other) =>
            Math.hypot(...f.parameters.slice(0, 3).map((v, j) => v - other.parameters[j])) < 0.05 &&
            Math.abs(f.parameters[6] - other.parameters[6]) < 0.002
        )
  );
}
