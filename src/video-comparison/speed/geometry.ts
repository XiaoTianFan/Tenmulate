import { project } from './projective';
export { project, atHeight, atDepth } from './projective';
import { COURT_KEYS, isNetLine, type Camera, type CourtLine, type Point, type ServeSetup } from './types';
import { fitCamera, type CameraControl } from './cameraFit';
export const COURT = {
  halfWidth: 4.115,
  length: 23.77,
  net: 11.885,
  farService: 18.285,
  postHeight: 1.07,
  centerHeight: 0.914,
  ballRadius: 0.0335
};
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
export function calibrate(setup: ServeSetup, width: number, height: number, validate = true): Camera {
  if (!COURT_KEYS.every((k) => setup.lines[k]))
    throw new Error('Mark both baselines, the far service line and three net-to-ground lines.');
  const { near, far } = setup.lines;
  const points = COURT_KEYS.flatMap((k) => setup.lines[k]!.points);
  if (
    !(width > 0 && height > 0) ||
    !Number.isFinite(setup.pixelError) ||
    setup.pixelError < 0.25 ||
    setup.pixelError > 30
  )
    throw new Error('Check the measurement uncertainties and physical assumptions.');
  if (!points.every((p) => Number.isFinite(p.x + p.y) && (!validate || (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1))))
    throw new Error('All calibration marks must be inside the original image.');
  const polygon = [near!.points[0], near!.points[1], far!.points[1], far!.points[0]],
    crosses = polygon.map((a, i) => {
      const b = polygon[(i + 1) % 4],
        c = polygon[(i + 2) % 4];
      return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    });
  if (!(crosses.every((v) => v > 0.0001) || crosses.every((v) => v < -0.0001)))
    throw new Error('The baseline endpoints must form a non-crossing court quadrilateral.');
  const controls: CameraControl[] = [];
  const add = (mark: CourtLine, endpoint: number, xyz: number[]) => {
    const annotation = setup.lines[mark]!;
    const sigma = Math.max(setup.pixelError, annotation.pixelFloor || 0);
    if (!Number.isFinite(sigma) || sigma > 100)
      throw new Error('Check the measurement uncertainties and physical assumptions.');
    controls.push({ mark, point: annotation.points[endpoint], xyz, sigma });
  };
  for (const [mark, y] of [
    ['near', 0],
    ['far', COURT.length],
    ['service', COURT.farService]
  ] as const) {
    add(mark, 0, [-COURT.halfWidth, y, 0]);
    add(mark, 1, [COURT.halfWidth, y, 0]);
  }
  const postX = setup.netSupports === 'doubles' ? 6.399 : 5.029;
  // The two supports may be marked in either order, including mirrored previews.
  const supports = [...(['netA', 'netB'] as const)].sort(
    (a, b) => setup.lines[a]!.points[1].x - setup.lines[b]!.points[1].x
  );
  if (error(setup.lines[supports[0]]!.points[1], setup.lines[supports[1]]!.points[1], width, height) < 4)
    throw new CalibrationError('Mark a different net support for A and B.', 'netB');
  supports.forEach((mark, i) => {
    add(mark, 0, [(i ? 1 : -1) * postX, COURT.net, COURT.postHeight]);
    add(mark, 1, [(i ? 1 : -1) * postX, COURT.net, 0]);
  });
  add('netCenter', 0, [0, COURT.net, COURT.centerHeight]);
  add('netCenter', 1, [0, COURT.net, 0]);
  for (const mark of COURT_KEYS.filter(isNetLine)) {
    const [top, ground] = setup.lines[mark]!.points;
    if (validate && error(top, ground, width, height) < Math.max(2, setup.pixelError))
      throw new CalibrationError(
        'The vertical line at {mark} is too short. Mark the net top and the ground beneath it.',
        mark
      );
  }
  const p = fitCamera(controls, width, height);
  const errors = controls.map((c) => error(project(p, c.xyz), c.point, width, height));
  const rms = Math.hypot(...errors) / Math.sqrt(errors.length),
    checkError = Math.max(...errors);
  const worst = controls[errors.indexOf(checkError)],
    worstMark = worst.mark;
  const span = Math.hypot(
    (Math.max(...polygon.map((p) => p.x)) - Math.min(...polygon.map((p) => p.x))) * width,
    (Math.max(...polygon.map((p) => p.y)) - Math.min(...polygon.map((p) => p.y))) * height
  );
  const typical = [...controls.map((c) => c.sigma)].sort((a, b) => a - b)[Math.floor(controls.length / 2)];
  if (
    validate &&
    (checkError > Math.max(14, 6 * worst.sigma, 0.035 * span) || rms > Math.max(8, 3 * typical, 0.02 * span))
  )
    throw new CalibrationError(
      'Court mapping disagrees most at {mark} ({error} px). Re-mark that line on a clear frame; check the net support type and camera movement.',
      worstMark,
      checkError
    );
  const residuals = COURT_KEYS.map((mark) => ({
    mark,
    pixels: Math.max(...errors.filter((_, i) => controls[i].mark === mark))
  }));
  const quality = errors.some((v, i) => v > 2.5 * controls[i].sigma) || rms > 1.5 * typical ? 'review' : 'good';
  return { p, rms, checkError, residuals, worstMark, quality, pixelError: Math.max(typical, rms) };
}
