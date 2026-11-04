import type { Point } from './types';
/** Small, scaled least-squares systems; pivot rejection prevents singular annotation fits. */
export function solve(a: number[][], b: number[]): number[] {
  const n = b.length,
    m = a.map((row, i) => [...row, b[i]]);
  const scale = Math.max(...a.flat().map(Math.abs));
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
    if (Math.abs(m[pivot][c]) < Math.max(1e-13, scale * 1e-11))
      throw new Error('Court marks are degenerate. Redraw the line endpoints and net tops.');
    [m[pivot], m[c]] = [m[c], m[pivot]];
    const d = m[c][c];
    for (let k = c; k <= n; k++) m[c][k] /= d;
    for (let r = 0; r < n; r++)
      if (r !== c) {
        const f = m[r][c];
        for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
      }
  }
  return m.map((row) => row[n]);
}
export function leastSquares(rows: number[][], values: number[]) {
  const n = rows[0].length,
    norms = Array.from({ length: n }, (_, i) => Math.sqrt(rows.reduce((s, r) => s + r[i] ** 2, 0)) || 1);
  const scaled = rows.map((r) => r.map((v, i) => v / norms[i]));
  return solve(
    Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => scaled.reduce((s, r) => s + r[i] * r[j], 0))
    ),
    Array.from({ length: n }, (_, i) => scaled.reduce((s, r, k) => s + r[i] * values[k], 0))
  ).map((v, i) => v / norms[i]);
}
export function project(p: number[][], xyz: number[]): Point {
  const q = p.map((row) => row[0] * xyz[0] + row[1] * xyz[1] + row[2] * xyz[2] + row[3]);
  if (!q.every(Number.isFinite) || q[2] <= 1e-6)
    throw new Error('The reconstructed flight is behind the camera. Check court and net marks.');
  return { x: q[0] / q[2], y: q[1] / q[2] };
}
export function atHeight(p: number[][], pixel: Point, z: number) {
  const rows = [p[0].map((v, i) => v - pixel.x * p[2][i]), p[1].map((v, i) => v - pixel.y * p[2][i])];
  const [x, y] = solve(
    rows.map((r) => r.slice(0, 2)),
    rows.map((r) => -r[3] - z * r[2])
  );
  project(p, [x, y, z]);
  return [x, y, z];
}
export function atDepth(p: number[][], pixel: Point, y: number) {
  const rows = [p[0].map((v, i) => v - pixel.x * p[2][i]), p[1].map((v, i) => v - pixel.y * p[2][i])];
  const [x, z] = solve(
    rows.map((r) => [r[0], r[2]]),
    rows.map((r) => -r[3] - y * r[1])
  );
  project(p, [x, y, z]);
  return [x, y, z];
}
