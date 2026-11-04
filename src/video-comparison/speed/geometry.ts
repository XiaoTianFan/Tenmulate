import type { Camera, Point, ServeSetup } from './types';
export const COURT = {
  halfWidth: 4.115,
  length: 23.77,
  net: 11.885,
  farService: 18.285,
  postHeight: 1.07,
  centerHeight: 0.914,
  ballRadius: 0.0335
};
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
const error = (a: Point, b: Point, width: number, height: number) =>
  Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
export function calibrate(setup: ServeSetup, width: number, height: number, validate = true): Camera {
  const { near, far, service, net } = setup.lines;
  if (!near || !far || !service || !net || !setup.netCenter)
    throw new Error('Mark both singles baselines, the far service line, net support tops and net centre.');
  const points = [...near, ...far, ...service, ...net, setup.netCenter];
  if (!points.every((p) => Number.isFinite(p.x + p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1))
    throw new Error('All calibration marks must be inside the original image.');
  const polygon = [near[0], near[1], far[1], far[0]],
    crosses = polygon.map((a, i) => {
      const b = polygon[(i + 1) % 4],
        c = polygon[(i + 2) % 4];
      return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    });
  if (!(crosses.every((v) => v > 0.0001) || crosses.every((v) => v < -0.0001)))
    throw new Error('The baseline endpoints must form a non-crossing court quadrilateral.');
  const controls = [
    [-COURT.halfWidth, 0],
    [COURT.halfWidth, 0],
    [-COURT.halfWidth, COURT.length],
    [COURT.halfWidth, COURT.length]
  ];
  const rows: number[][] = [],
    targets: number[] = [];
  controls.forEach(([x, y], i) => {
    const { x: u, y: v } = points[i];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]);
    targets.push(u, v);
  });
  const h = leastSquares(rows, targets),
    p = [
      [h[0], h[1], 0, h[2]],
      [h[3], h[4], 0, h[5]],
      [h[6], h[7], 0, 1]
    ];
  const postX = setup.netSupports === 'doubles' ? 6.399 : 5.029;
  const zRows: number[][] = [],
    zTargets: number[] = [];
  [-postX, postX].forEach((x, i) => {
    const q = p.map((r) => r[0] * x + r[1] * COURT.net + r[3]),
      { x: u, y: v } = net[i];
    zRows.push([1, 0, -u], [0, 1, -v]);
    zTargets.push((u * q[2] - q[0]) / COURT.postHeight, (v * q[2] - q[1]) / COURT.postHeight);
  });
  const column = leastSquares(zRows, zTargets);
  p.forEach((r, i) => {
    r[2] = column[i];
  });
  const netErrors = [-postX, postX].map((x, i) =>
    error(project(p, [x, COURT.net, COURT.postHeight]), net[i], width, height)
  );
  const checks = [-COURT.halfWidth, COURT.halfWidth].map((x, i) =>
    error(project(p, [x, COURT.farService, 0]), service[i], width, height)
  );
  checks.push(error(project(p, [0, COURT.net, COURT.centerHeight]), setup.netCenter, width, height));
  const rms = Math.hypot(...netErrors) / Math.sqrt(2),
    checkError = Math.max(...checks);
  const elevation = error(project(p, [0, COURT.net, 0]), project(p, [0, COURT.net, COURT.centerHeight]), width, height);
  if (
    validate &&
    (elevation < Math.max(3, setup.pixelError * 2) ||
      rms > Math.max(3, setup.pixelError * 3) ||
      checkError > Math.max(5, setup.pixelError * 4))
  )
    throw new Error(
      'Court or net calibration does not agree with the check marks. Review the service line, post type and net centre.'
    );
  return { p, rms, checkError };
}
