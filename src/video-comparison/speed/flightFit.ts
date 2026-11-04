import type { BallMark, Point } from './types';

// Effective Magnus coefficient, not an inferred spin rate. Negative lift bends
// the ball downward (topspin). Motion remains in the endpoint vertical plane.
export const MAX_FITTED_LIFT = 0.04;
export type FlightObservation = BallMark & { fraction: number; sigma: number };
export type FlightFit = {
  method: 'endpoints' | 'flight-points';
  lift: number;
  liftRange: [number, number];
  observations: {
    frame: number;
    residualPixels: number;
    tolerancePixels: number;
    used: boolean;
  }[];
};
type Model = { path: Point[] };

export function flightResidual(path: Point[], observation: FlightObservation, width: number, height: number) {
  const n = Math.max(0, Math.min(path.length - 1, observation.fraction * (path.length - 1)));
  const a = path[Math.floor(n)],
    b = path[Math.min(path.length - 1, Math.floor(n) + 1)],
    f = n % 1;
  return Math.hypot(
    (observation.x - a.x - (b.x - a.x) * f) * width,
    (observation.y - a.y - (b.y - a.y) * f) * height
  );
}

/** Bounded robust 1-D fit with exact contact/bounce/time constraints. Consensus
 * keeps one badly placed check from bending the whole flight. Rejected marks
 * are always reported; ambiguous/minority fits fail rather than invent a path. */
export function fitFlight<T extends Model>(
  make: (lift: number) => T,
  observations: FlightObservation[],
  width: number,
  height: number,
  strict = true
): { value: T; fit: FlightFit } {
  const empty: FlightFit = {
    method: 'endpoints',
    lift: 0,
    liftRange: [0, 0],
    observations: []
  };
  if (!observations.length) return { value: make(0), fit: empty };
  const evaluated = new Map<number, { value: T; residuals: number[]; loss: number; lift: number }>();
  const evaluate = (lift: number) => {
    if (evaluated.has(lift)) return evaluated.get(lift)!;
    try {
      const value = make(lift),
        residuals = observations.map((o) => flightResidual(value.path, o, width, height));
      const loss = residuals.reduce((sum, r, i) => sum + Math.min(16, (r / observations[i].sigma) ** 2), 0);
      if (!Number.isFinite(loss)) return undefined;
      const item = { value, residuals, loss, lift };
      evaluated.set(lift, item);
      return item;
    } catch {
      return undefined;
    }
  };
  const flat = evaluate(0);
  const steps = 40,
    step = (2 * MAX_FITTED_LIFT) / steps;
  for (let i = 0; i <= steps; i++) evaluate(-MAX_FITTED_LIFT + i * step);
  let best = [...evaluated.values()].sort(
    (a, b) => a.loss - b.loss || Math.abs(a.lift) - Math.abs(b.lift)
  )[0];
  if (!best) throw new Error('The flight model did not converge. Check timing and calibration.');
  let low = Math.max(-MAX_FITTED_LIFT, best.lift - step),
    high = Math.min(MAX_FITTED_LIFT, best.lift + step);
  const golden = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 26; i++) {
    const a = high - (high - low) * golden,
      b = low + (high - low) * golden;
    if ((evaluate(a)?.loss ?? Infinity) <= (evaluate(b)?.loss ?? Infinity)) high = b;
    else low = a;
  }
  best = [...evaluated.values()].sort((a, b) => a.loss - b.loss || Math.abs(a.lift) - Math.abs(b.lift))[0];
  // Do not introduce spin to explain sub-precision annotation noise on a flat serve.
  if (flat && flat.residuals.every((r, i) => r <= observations[i].sigma)) best = flat;
  const diagnostics = best.residuals.map((residualPixels, i) => ({
    frame: observations[i].frame,
    residualPixels,
    tolerancePixels: Math.max(5, 3 * observations[i].sigma),
    used: residualPixels <= Math.max(5, 3 * observations[i].sigma)
  }));
  if (strict && diagnostics.filter((o) => o.used).length < Math.ceil(observations.length * 0.6))
    throw new Error(
      'The flight checks disagree with a physically plausible curved trajectory. Review ball identity, timing, court mapping or sidespin.'
    );
  // Profile the accepted marks only. This is a sensitivity range, not a statistical CI.
  const loss = (item: NonNullable<ReturnType<typeof evaluate>>) =>
    item.residuals.reduce(
      (sum, r, i) => sum + (diagnostics[i].used ? (r / observations[i].sigma) ** 2 : 0),
      0
    );
  const limit = loss(best) + 9;
  const plausible = [...evaluated.values()].filter((item) => loss(item) <= limit).map((item) => item.lift);
  return {
    value: best.value,
    fit: {
      method: 'flight-points',
      lift: best.lift,
      liftRange: [Math.min(best.lift, ...plausible), Math.max(best.lift, ...plausible)],
      observations: diagnostics
    }
  };
}

/** Warm-started least-squares refit for nearby sensitivity trials. These use only
 * the central fit's accepted observations; they cannot switch to another object. */
export function refitFlight<T extends Model>(
  make: (lift: number) => T,
  observations: FlightObservation[],
  width: number,
  height: number,
  initial: number
): T {
  const residuals = (value: T) =>
    observations.flatMap((o) => {
      const n = Math.max(0, Math.min(value.path.length - 1, o.fraction * (value.path.length - 1)));
      const a = value.path[Math.floor(n)],
        b = value.path[Math.min(value.path.length - 1, Math.floor(n) + 1)],
        f = n % 1;
      return [
        ((a.x + (b.x - a.x) * f - o.x) * width) / o.sigma,
        ((a.y + (b.y - a.y) * f - o.y) * height) / o.sigma
      ];
    });
  const squared = (r: number[]) => r.reduce((sum, v) => sum + v * v, 0);
  let lift = initial,
    value = make(lift),
    r = residuals(value),
    loss = squared(r);
  for (let i = 0; i < 5; i++) {
    const h = lift + 0.0001 > MAX_FITTED_LIFT ? -0.0001 : 0.0001;
    const next = residuals(make(lift + h)),
      j = next.map((v, k) => (v - r[k]) / h);
    const norm = squared(j);
    if (norm < 1e-8) break;
    const delta = Math.max(-0.02, Math.min(0.02, -r.reduce((sum, v, k) => sum + v * j[k], 0) / norm));
    let improved = false;
    for (const scale of [1, 0.5, 0.25]) {
      const candidate = Math.max(-MAX_FITTED_LIFT, Math.min(MAX_FITTED_LIFT, lift + scale * delta));
      if (Math.abs(candidate - lift) < 1e-7) return value;
      const model = make(candidate),
        errors = residuals(model),
        score = squared(errors);
      if (score < loss) {
        lift = candidate;
        value = model;
        r = errors;
        loss = score;
        improved = true;
        break;
      }
    }
    if (!improved) break;
  }
  return value;
}
