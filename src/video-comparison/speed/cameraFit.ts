import { leastSquares, project } from './projective';
import type { CourtLine, Point } from './types';
export type CameraControl = { xyz: number[]; point: Point; sigma: number; mark: CourtLine };
const matrix = (a: number[]) => [a.slice(0, 4), a.slice(4, 8), [...a.slice(8, 11), 1]];
/** Joint projective fit. Refine weighted DLT in image pixels with a Huber loss.
 * All ground and elevated endpoints contribute; residuals are still reported for
 * every observation, including downweighted ones. No mark is silently discarded. */
export function fitCamera(controls: CameraControl[], width: number, height: number) {
  const rows: number[][] = [],
    targets: number[] = [];
  for (const {
    xyz: [x, y, z],
    point: { x: u, y: v },
    sigma
  } of controls) {
    rows.push(
      [x, y, z, 1, 0, 0, 0, 0, -u * x, -u * y, -u * z].map((n) => (n * width) / sigma),
      [0, 0, 0, 0, x, y, z, 1, -v * x, -v * y, -v * z].map((n) => (n * height) / sigma)
    );
    targets.push((u * width) / sigma, (v * height) / sigma);
  }
  let a = leastSquares(rows, targets),
    damping = 1e-4;
  const loss = (parameters: number[]) => {
    try {
      const p = matrix(parameters);
      return controls.reduce((total, c) => {
        const q = project(p, c.xyz),
          r = Math.hypot((q.x - c.point.x) * width, (q.y - c.point.y) * height) / c.sigma;
        return total + (r <= 2.5 ? r * r : 5 * r - 6.25);
      }, 0);
    } catch {
      return Infinity;
    }
  };
  for (let iteration = 0; iteration < 24; iteration++) {
    const p = matrix(a),
      jacobian: number[][] = [],
      residual: number[] = [];
    for (const c of controls) {
      const point = project(p, c.xyz),
        q = [...c.xyz, 1],
        depth = p[2].reduce((sum, v, i) => sum + v * q[i], 0);
      const dx = (c.point.x - point.x) * width,
        dy = (c.point.y - point.y) * height;
      const robust = Math.sqrt(Math.min(1, 2.5 / (Math.hypot(dx, dy) / c.sigma || 1))) / c.sigma;
      const jx = [...q.map((v) => v / depth), 0, 0, 0, 0, ...c.xyz.map((v) => (-point.x * v) / depth)].map(
        (v) => v * width * robust
      );
      const jy = [0, 0, 0, 0, ...q.map((v) => v / depth), ...c.xyz.map((v) => (-point.y * v) / depth)].map(
        (v) => v * height * robust
      );
      jacobian.push(jx, jy);
      residual.push(dx * robust, dy * robust);
    }
    const norms = Array.from(
      { length: 11 },
      (_, i) => Math.sqrt(jacobian.reduce((sum, row) => sum + row[i] ** 2, 0)) || 1
    );
    const current = loss(a);
    let improvement = 0;
    for (let attempt = 0; attempt < 6; attempt++) {
      const regularizer = norms.map((n, i) =>
        Array.from({ length: 11 }, (_, j) => (i === j ? n * Math.sqrt(damping) : 0))
      );
      const delta = leastSquares([...jacobian, ...regularizer], [...residual, ...norms.map(() => 0)]);
      const trial = a.map((v, i) => v + delta[i]),
        score = loss(trial);
      if (score < current) {
        a = trial;
        improvement = current - score;
        damping = Math.max(1e-9, damping / 3);
        break;
      }
      damping *= 10;
    }
    if (improvement < 1e-9 * (1 + current)) break;
  }
  return matrix(a);
}
