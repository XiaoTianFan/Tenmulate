import { project } from './projective';
import { correctLens, distortLens, MAX_LENS } from './lens';
export { project, atHeight, atDepth } from './projective';
import {
  GROUND_KEYS,
  isNetLine,
  type Camera,
  type CourtLine,
  type CourtMapping,
  type Point,
  type ServeSetup
} from './types';
import { fitCamera } from './cameraFit';
import { COURT, courtControls, possibleMappings } from './courtControls';
import { courtCoverage, courtRequirement, markedCourtKeys } from './courtCoverage';
export { COURT } from './courtControls';
const error = (a: Point, b: Point, width: number, height: number) =>
  Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
export const contactCourtDepth = (setup: ServeSetup, depth = setup.contactDepth) =>
  setup.servingEnd === 'far' ? COURT.length - depth : depth;
export class CalibrationError extends Error {
  constructor(
    message: string,
    readonly mark?: CourtLine,
    readonly pixels?: number
  ) {
    super(message);
  }
}
/** Fit only observed controls. Competing half/post assignments must be separated
 * by their standardized reprojection loss; uncertainty trials cannot switch sides. */
export function calibrate(
  setup: ServeSetup,
  width: number,
  height: number,
  validate = true,
  expected?: CourtMapping
): Camera {
  const raw = setup,
    strength = setup.lens ?? 0;
  if (!Number.isFinite(strength) || Math.abs(strength) > MAX_LENS)
    throw new Error('Check the measurement uncertainties and physical assumptions.');
  const requirement = courtRequirement(setup);
  if (requirement) throw new Error(requirement);
  const keys = markedCourtKeys(setup),
    points = keys.flatMap((k) => setup.lines[k]!.points);
  if (
    !(width > 0 && height > 0) ||
    !Number.isFinite(setup.pixelError) ||
    setup.pixelError < 0.25 ||
    setup.pixelError > 30
  )
    throw new Error('Check the measurement uncertainties and physical assumptions.');
  if (
    !points.every(
      (p) => Number.isFinite(p.x + p.y) && (!validate || (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1))
    )
  )
    throw new Error('All calibration marks must be inside the original image.');
  setup = {
    ...raw,
    lines: Object.fromEntries(
      Object.entries(raw.lines).map(([key, mark]) => [
        key,
        {
          ...mark!,
          points: mark!.points.map((p) => correctLens(p, strength, width, height))
        }
      ])
    )
  };
  const full = GROUND_KEYS.filter((k) => setup.lines[k] && setup.lines[k]!.span !== 'half');
  const near = setup.lines[full[0]]!,
    far = setup.lines[full.at(-1)!]!;
  const polygon = [near.points[0], near.points[1], far.points[1], far.points[0]];
  const crosses = polygon.map((a, i) => {
    const b = polygon[(i + 1) % 4],
      c = polygon[(i + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  });
  if (!(crosses.every((v) => v > 1e-10) || crosses.every((v) => v < -1e-10)))
    throw new Error('The full-width court lines must form a non-crossing quadrilateral.');
  if (
    setup.lines.netA &&
    setup.lines.netB &&
    error(setup.lines.netA.points[1], setup.lines.netB.points[1], width, height) < 4
  )
    throw new CalibrationError('Mark a different net support for A and B.', 'netB');
  for (const mark of keys.filter(isNetLine)) {
    const [top, ground] = setup.lines[mark]!.points;
    if (validate && error(top, ground, width, height) < Math.max(2, setup.pixelError))
      throw new CalibrationError(
        'The vertical line at {mark} is too short. Mark the net top and the ground beneath it.',
        mark
      );
  }
  const candidates = possibleMappings(setup)
    .flatMap((mapping) => {
      try {
        const controls = courtControls(setup, mapping),
          p = fitCamera(controls, width, height);
        const errors = controls.map((c) =>
          error(
            distortLens(project(p, c.xyz), strength, width, height),
            raw.lines[c.mark]!.points[c.endpoint],
            width,
            height
          )
        );
        const score = errors.reduce((sum, value, i) => {
          const r = value / controls[i].sigma;
          return sum + (r <= 2.5 ? r * r : 5 * r - 6.25);
        }, 0);
        return [{ mapping, controls, p, errors, score }];
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.score - b.score);
  if (!candidates.length)
    throw new Error('Court marks are degenerate. Redraw the line endpoints and net tops.');
  const { mapping, controls, p, errors } = candidates[0];
  const rms = Math.hypot(...errors) / Math.sqrt(errors.length),
    checkError = Math.max(...errors);
  const worst = controls[errors.indexOf(checkError)],
    worstMark = worst.mark;
  const span = Math.hypot(
    (Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))) * width,
    (Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y))) * height
  );
  const typical = controls.map((c) => c.sigma).sort((a, b) => a - b)[Math.floor(controls.length / 2)];
  if (
    validate &&
    (checkError > Math.max(14, 6 * worst.sigma, 0.035 * span) || rms > Math.max(8, 3 * typical, 0.02 * span))
  )
    throw new CalibrationError(
      'Court mapping disagrees most at {mark} ({error} px). Re-mark that line on a clear frame; check the net support type and camera movement.',
      worstMark,
      checkError
    );
  if (candidates[1] && candidates[1].score - candidates[0].score < 9)
    throw new Error(
      'The court side is ambiguous. Add another full court line or re-mark the centre and side support.'
    );
  if (
    expected &&
    (GROUND_KEYS.some((key) => expected.halves[key] !== mapping.halves[key]) ||
      (['netA', 'netB'] as const).some((key) => expected.supports[key] !== mapping.supports[key]))
  )
    throw new Error(
      'Small annotation changes make this estimate unstable. Refine court, net and ball marks.'
    );
  const residuals = keys.map((mark) => ({
    mark,
    pixels: Math.max(...errors.filter((_, i) => controls[i].mark === mark))
  }));
  const quality =
    errors.some((v, i) => v > 2.5 * controls[i].sigma) || rms > 1.5 * typical ? 'review' : 'good';
  return {
    p,
    ...(strength ? { lens: { strength, width, height } } : {}),
    rms,
    checkError,
    residuals,
    worstMark,
    quality,
    pixelError: Math.max(typical, rms),
    mapping,
    coverage: courtCoverage(setup),
    controls: controls.map((c) => ({
      mark: c.mark,
      endpoint: c.endpoint,
      world: c.xyz
    }))
  };
}
