import { calibrate, atHeight, atDepth, contactCourtDepth, project, COURT } from './geometry';
import { reconstruct } from './physics';
import { COURT_KEYS, type Point, type ServeSetup, type SpeedInput, type SpeedResult, type Camera } from './types';
const clone = (s: ServeSetup): ServeSetup => ({
  ...s,
  lines: Object.fromEntries(
    Object.entries(s.lines).map(([k, line]) => [k, { ...line!, points: line!.points.map((p) => ({ ...p })) }])
  ),
  contact: s.contact && { ...s.contact },
  bounce: s.bounce && { ...s.bounce },
  flight: s.flight.map((p) => ({ ...p }))
});
function frameHalfSpan(input: SpeedInput, f: number) {
  const times = input.index.timestamps;
  return Math.max(
    f > 0 ? times[f] - times[f - 1] : times[Math.min(1, times.length - 1)] - times[0],
    f + 1 < times.length ? times[f + 1] - times[f] : input.index.end - times[f]
  );
}
function candidate(
  input: SpeedInput,
  setup: ServeSetup,
  duration: number,
  depth: number,
  drag: number,
  lift: number,
  validate: boolean,
  fitted?: Camera
) {
  const camera = fitted ?? calibrate(setup, input.width, input.height, validate),
    contact = atDepth(camera.p, setup.contact!, contactCourtDepth(setup, depth)),
    bounce = atHeight(camera.p, setup.bounce!, COURT.ballRadius);
  const height = contact[2];
  if (!(height >= 0.3 && height <= 5.5))
    throw new Error('The derived contact height is implausible. Check the ball mark, serving end and contact depth.');
  const dx = bounce[0] - contact[0],
    dy = bounce[1] - contact[1],
    distance = Math.hypot(dx, dy);
  if (
    distance < 1 ||
    distance > 40 ||
    Math.min(Math.abs(contact[1]), Math.abs(contact[1] - COURT.length)) > 3 ||
    Math.abs(contact[0]) > COURT.halfWidth + 2 ||
    (contact[1] - COURT.net) * (bounce[1] - COURT.net) >= 0
  )
    throw new Error(
      'The reconstructed contact and bounce do not describe a serve across the net. Check serving end, contact depth, court lines and ball marks.'
    );
  const model = reconstruct(distance, duration, height, COURT.ballRadius, drag, lift);
  const path = model.path.map((q) => {
    const xyz: [number, number, number] = [
      contact[0] + (dx * q.distance) / distance,
      contact[1] + (dy * q.distance) / distance,
      q.z
    ];
    return { ...project(camera.p, xyz), z: q.z, time: q.time, world: xyz };
  });
  const crossing = ((COURT.net - contact[1]) / dy) * distance;
  let clearance = Infinity;
  for (let i = 1; i < model.path.length; i++)
    if (model.path[i].distance >= crossing) {
      const a = model.path[i - 1],
        b = model.path[i],
        t = (crossing - a.distance) / (b.distance - a.distance);
      const x = contact[0] + (dx * crossing) / distance;
      const support = setup.netSupports === 'doubles' ? 6.399 : 5.029;
      clearance =
        a.z +
        (b.z - a.z) * t -
        COURT.ballRadius -
        (COURT.centerHeight + (COURT.postHeight - COURT.centerHeight) * (x / support) ** 2);
      break;
    }
  if (validate && (clearance < 0 || model.path.slice(0, -1).some((q) => q.z < COURT.ballRadius - 1e-4)))
    throw new Error(
      'The model reaches the net or ground before the marked bounce. Check for an earlier collision or revise the annotations.'
    );
  return { camera, contact, bounce, distance, model, path, clearance };
}
export function estimateServe(input: SpeedInput, progress: (fraction: number) => void = () => {}): SpeedResult {
  const s = input.setup,
    times = input.index.timestamps;
  if (!(input.width > input.height && input.height > 0))
    throw new Error('Serve speed needs a landscape recording with the full court visible.');
  if (input.contact === null || !s.contact || s.contact.frame !== input.contact)
    throw new Error('Mark the ball on the selected contact frame.');
  if (
    !s.bounce ||
    s.bounce.frame <= input.contact ||
    s.bounce.frame > input.end ||
    s.bounce.frame >= times.length ||
    input.contact < input.start ||
    input.contact < 0 ||
    !Number.isInteger(s.bounce.frame) ||
    !Number.isInteger(input.contact)
  )
    throw new Error('Mark the first bounce after contact, inside the excerpt.');
  if (
    !COURT_KEYS.every((k) => {
      const m = s.lines[k];
      return m && Number.isInteger(m.frame) && m.frame >= 0 && m.frame < times.length;
    })
  )
    throw new Error('Each court line needs a valid source frame.');
  if (
    ![s.contactDepth, s.depthError, s.pixelError, s.frameError, s.slowdown, s.drag, s.dragError, s.liftError].every(
      Number.isFinite
    ) ||
    s.contactDepth < -1 ||
    s.contactDepth > 3 ||
    s.depthError < 0 ||
    s.depthError > 1.5 ||
    !['near', 'far'].includes(s.servingEnd) ||
    s.pixelError < 0.25 ||
    s.pixelError > 30 ||
    s.frameError < 0.5 ||
    s.frameError > 3 ||
    s.slowdown < 1 ||
    s.slowdown > 16 ||
    s.drag < 0 ||
    s.drag > 0.06 ||
    s.dragError < 0 ||
    s.dragError > s.drag ||
    s.liftError < 0 ||
    s.liftError > 0.02
  )
    throw new Error('Check the measurement uncertainties and physical assumptions.');
  const marks = [s.contact, s.bounce, ...s.flight];
  if (
    s.flight.length > 24 ||
    !marks.every(
      (p) =>
        Number.isInteger(p.frame) &&
        p.frame >= input.contact! &&
        p.frame <= s.bounce!.frame &&
        Number.isFinite(p.x + p.y + p.radius) &&
        p.x >= 0 &&
        p.x <= 1 &&
        p.y >= 0 &&
        p.y <= 1 &&
        p.radius >= 0
    )
  )
    throw new Error('Ball checks must lie between contact and the first bounce.');
  const duration = (times[s.bounce.frame] - times[input.contact]) / s.slowdown;
  const timeError =
    (s.frameError * (frameHalfSpan(input, input.contact) + frameHalfSpan(input, s.bounce.frame))) / s.slowdown;
  if (duration - timeError <= 0.03 || duration + timeError > 3)
    throw new Error('Contact and bounce timing is too uncertain. Check the frames and recording slowdown.');
  const base = candidate(input, s, duration, s.contactDepth, s.drag, 0, true),
    speeds = [base.model.kph],
    heights = [base.contact[2]];
  const annotationError = base.camera.pixelError;
  const flightPoints = s.flight.filter((p) => p.frame > input.contact! && p.frame < s.bounce!.frame);
  const residuals = flightPoints.map((mark) => {
    const t = (times[mark.frame] - times[input.contact!]) / s.slowdown;
    const i = Math.min(base.path.length - 2, Math.max(0, Math.floor((t / duration) * (base.path.length - 1)))),
      a = base.path[i],
      b = base.path[i + 1],
      f = (t - a.time) / (b.time - a.time);
    return Math.hypot((mark.x - a.x - (b.x - a.x) * f) * input.width, (mark.y - a.y - (b.y - a.y) * f) * input.height);
  });
  const flightRms = residuals.length ? Math.hypot(...residuals) / Math.sqrt(residuals.length) : null;
  if (residuals.some((r, i) => r > Math.max(5, 3 * annotationError, 3 * flightPoints[i].radius)))
    throw new Error(
      'The flight checks disagree with the model. Review ball identity, timing, contact depth or camera movement.'
    );
  // Corners of timing/depth/drag/lift, followed by independent and correlated
  // annotation perturbations. This is a sensitivity envelope, never a probability CI.
  const variants: {
    setup: ServeSetup;
    duration: number;
    depth: number;
    drag: number;
    lift: number;
    camera?: Camera;
  }[] = [];
  for (const a of [-1, 1])
    for (const b of [-1, 1])
      for (const c of [-1, 1])
        for (const d of [-1, 1])
          variants.push({
            setup: s,
            duration: duration + a * timeError,
            depth: s.contactDepth + b * s.depthError,
            drag: s.drag + c * s.dragError,
            lift: d * s.liftError,
            camera: base.camera
          });
  const perturb = (p: Point, axis: 'x' | 'y', delta: number) => {
    p[axis] += delta / (axis === 'x' ? input.width : input.height);
  };
  for (const mark of COURT_KEYS)
    for (let endpoint = 0; endpoint < 2; endpoint++)
      for (const axis of ['x', 'y'] as const)
        for (const sign of [-1, 1]) {
          const setup = clone(s),
            annotation = setup.lines[mark]!;
          perturb(annotation.points[endpoint], axis, sign * Math.max(annotationError, annotation.pixelFloor));
          variants.push({ setup, duration, depth: s.contactDepth, drag: s.drag, lift: 0 });
        }
  for (const key of ['contact', 'bounce'] as const)
    for (const axis of ['x', 'y'] as const)
      for (const sign of [-1, 1]) {
        const setup = clone(s);
        perturb(setup[key]!, axis, sign * Math.max(annotationError, s[key]!.radius));
        variants.push({ setup, duration, depth: s.contactDepth, drag: s.drag, lift: 0, camera: base.camera });
      }
  let seed = 0x1472abcd;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 4294967296) * 2 - 1;
  };
  for (let i = 0; i < 64; i++) {
    const setup = clone(s),
      biasX = random(),
      biasY = random();
    for (const line of Object.values(setup.lines))
      for (const p of line!.points) {
        perturb(p, 'x', (i % 2 ? random() : biasX) * Math.max(annotationError, line!.pixelFloor));
        perturb(p, 'y', (i % 2 ? random() : biasY) * Math.max(annotationError, line!.pixelFloor));
      }
    for (const key of ['contact', 'bounce'] as const) {
      perturb(setup[key]!, 'x', random() * Math.max(annotationError, setup[key]!.radius));
      perturb(setup[key]!, 'y', random() * Math.max(annotationError, setup[key]!.radius));
    }
    variants.push({
      setup,
      duration: duration + random() * timeError,
      depth: s.contactDepth + random() * s.depthError,
      drag: s.drag + random() * s.dragError,
      lift: random() * s.liftError
    });
  }
  let collisionVariants = 0;
  variants.forEach((v, i) => {
    try {
      const r = candidate(input, v.setup, v.duration, v.depth, v.drag, v.lift, false, v.camera);
      speeds.push(r.model.kph);
      heights.push(r.contact[2]);
      if (r.clearance < 0) collisionVariants++;
    } catch {
      throw new Error('Small annotation changes make this estimate unstable. Refine court, net and ball marks.');
    }
    progress((i + 1) / variants.length);
  });
  const rangeKph: [number, number] = [Math.min(...speeds), Math.max(...speeds)];
  if ((rangeKph[1] - rangeKph[0]) / base.model.kph > 0.5)
    throw new Error(
      'The speed range is too wide to report reliably. Refine timing, court marks or contact-depth uncertainty.'
    );
  return {
    launchKph: base.model.kph,
    rangeKph,
    horizontalMeanKph: (3.6 * base.distance) / duration,
    flightSeconds: duration,
    distance: base.distance,
    contact3D: base.contact,
    contactHeightRange: [Math.min(...heights), Math.max(...heights)],
    bounce3D: base.bounce,
    velocity: base.model.velocity,
    camera: base.camera,
    netClearance: base.clearance,
    flightRms,
    checkedPoints: flightPoints.length,
    variants: variants.length,
    collisionVariants,
    path: base.path
  };
}
