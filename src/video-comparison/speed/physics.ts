// Adapted from Tennis Match Edit's MIT-licensed launch_speed.py, revision
// 2b63d12ad7dfb85c30d4c2e3d38e5c9d873a6b78. See public/licenses/tennis-point-edit-review.txt.
export type Flight = { q: number[]; path: { distance: number; z: number; time: number }[] };
export function flight(vx: number, vz: number, height: number, duration: number, drag = 0.02, lift = 0): Flight {
  const steps = Math.max(100, Math.ceil(duration * 240)),
    dt = duration / steps;
  let q = [0, height, vx, vz];
  const path = [{ distance: 0, z: height, time: 0 }];
  const derivative = ([, , u, w]: number[]) => {
    const v = Math.hypot(u, w);
    return [u, w, -drag * v * u - lift * v * w, -9.81 - drag * v * w + lift * v * u];
  };
  for (let s = 0; s < steps; s++) {
    const a = derivative(q),
      b = derivative(q.map((v, i) => v + (dt * a[i]) / 2)),
      c = derivative(q.map((v, i) => v + (dt * b[i]) / 2)),
      d = derivative(q.map((v, i) => v + dt * c[i]));
    q = q.map((v, i) => v + (dt * (a[i] + 2 * b[i] + 2 * c[i] + d[i])) / 6);
    if (!q.every(Number.isFinite)) throw new Error('The flight model did not converge. Check timing and calibration.');
    path.push({ distance: q[0], z: q[1], time: (s + 1) * dt });
  }
  return { q, path };
}
export function reconstruct(
  distance: number,
  duration: number,
  height: number,
  endHeight = 0.0335,
  drag = 0.02,
  lift = 0
) {
  if (
    ![distance, duration, height, endHeight, drag, lift].every(Number.isFinite) ||
    distance <= 0 ||
    duration <= 0 ||
    duration > 3 ||
    height < 0 ||
    endHeight < 0 ||
    drag < 0
  )
    throw new Error('Check the physical duration, contact height and drag settings.');
  let vx = distance / duration,
    vz = (endHeight - height) / duration + (9.81 * duration) / 2;
  for (let i = 0; i < 25; i++) {
    const current = flight(vx, vz, height, duration, drag, lift),
      ex = current.q[0] - distance,
      ez = current.q[1] - endHeight;
    if (Math.hypot(ex, ez) < 1e-5 && vx > 0) return { ...current, velocity: [vx, vz], kph: 3.6 * Math.hypot(vx, vz) };
    const x = flight(vx + 0.001, vz, height, duration, drag, lift).q,
      z = flight(vx, vz + 0.001, height, duration, drag, lift).q;
    const a = (x[0] - current.q[0]) / 0.001,
      c = (x[1] - current.q[1]) / 0.001,
      b = (z[0] - current.q[0]) / 0.001,
      d = (z[1] - current.q[1]) / 0.001,
      det = a * d - b * c;
    if (Math.abs(det) < 1e-10) break;
    const dx = (d * ex - b * ez) / det,
      dz = (-c * ex + a * ez) / det;
    let improved = false;
    for (let step = 1; step >= 1 / 32; step /= 2) {
      const u = vx - step * dx,
        w = vz - step * dz;
      if (u <= 0 || Math.hypot(u, w) > 2000) continue;
      const trial = flight(u, w, height, duration, drag, lift).q;
      if (Math.hypot(trial[0] - distance, trial[1] - endHeight) < Math.hypot(ex, ez)) {
        vx = u;
        vz = w;
        improved = true;
        break;
      }
    }
    if (!improved) break;
  }
  throw new Error('The flight model did not converge. Check timing and calibration.');
}
