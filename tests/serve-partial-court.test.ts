import { describe, expect, it } from 'vitest';
import { calibrate, atDepth, COURT, project } from '../src/video-comparison/speed/geometry';
import { estimateServe } from '../src/video-comparison/speed/estimate';
import { reconstruct } from '../src/video-comparison/speed/physics';
import { courtRequirement } from '../src/video-comparison/speed/courtCoverage';
import { newServeSetup, GROUND_KEYS, type GroundLine, type SpeedInput } from '../src/video-comparison/speed/types';
import { serveSpeedData } from '../src/video-comparison/dataExport/serve';

/** Independent physical pinhole camera, optionally cropped to an actual portrait
 * view. The unobserved baseline/post is outside the source, not invented evidence. */
function scene(width = 1280, offset = 0) {
  const norm = Math.hypot(26, 10),
    c = 26 / norm,
    s = 10 / norm,
    depth = 14 * c + 10 * s;
  const p = [
    [700 / 1280, 0.5 * c, -0.5 * s, 0.5 * depth],
    [0, (-700 / 720) * s + 0.5 * c, (-700 / 720) * c - 0.5 * s, (-700 / 720) * (14 * s - 10 * c) + 0.5 * depth],
    [0, c, -s, depth]
  ];
  p[0] = p[0].map((v, i) => (1280 * v - offset * p[2][i]) / width);
  const setup = newServeSetup();
  setup.contactDepth = 0.4;
  const ground = (key: GroundLine, side?: 'left' | 'right') => {
    const y = { near: 0, nearService: 5.485, service: 18.285, far: 23.77 }[key];
    setup.lines[key] = {
      frame: 0,
      pixelFloor: 1,
      points: [project(p, [side === 'right' ? 0 : -4.115, y, 0]), project(p, [side === 'left' ? 0 : 4.115, y, 0])],
      ...(side ? { span: 'half' as const } : {})
    };
  };
  GROUND_KEYS.forEach((key) => ground(key));
  for (const [key, x, z] of [
    ['netA', -6.399, 1.07],
    ['netB', 6.399, 1.07],
    ['netCenter', 0, 0.914]
  ] as const)
    setup.lines[key] = { frame: 0, pixelFloor: 1, points: [project(p, [x, 11.885, z]), project(p, [x, 11.885, 0])] };
  setup.contact = { ...project(p, [-1, 0.4, 2.6]), frame: 10, radius: 1 };
  setup.bounce = { ...project(p, [1, 20, 0.0335]), frame: 43, radius: 1 };
  const input: SpeedInput = {
    setup,
    width,
    height: 720,
    contact: 10,
    start: 0,
    end: 89,
    index: { timestamps: Float64Array.from({ length: 90 }, (_, i) => i / 60), fps: 60, end: 1.5, variable: false }
  };
  return { input, ground, p };
}

describe('partial court calibration and portrait sources', () => {
  it.each(GROUND_KEYS)('accepts any three complete court lines, omitting %s', (omitted) => {
    const { input } = scene();
    delete input.setup.lines[omitted];
    expect(courtRequirement(input.setup)).toBeUndefined();
    const camera = calibrate(input.setup, input.width, input.height);
    expect(camera.rms).toBeLessThan(1e-6);
    expect(camera.coverage).toEqual({ groundLines: 3, netLines: 3, halfLines: 0 });
    expect(atDepth(camera.p, input.setup.contact!, 0.4)[2]).toBeCloseTo(2.6, 6);
  });
  it('reconstructs a portrait clip without a visible near baseline or second post', () => {
    const { input } = scene(380, 480);
    delete input.setup.lines.near;
    delete input.setup.lines.netA;
    const result = estimateServe(input);
    expect(result.camera.mapping?.supports).toEqual({ netB: 'right' });
    expect(result.camera.controls).toHaveLength(10);
    expect(result.launchKph).toBeCloseTo(reconstruct(Math.hypot(2, 19.6), 0.55, 2.6).kph, 4);
    expect(result.variants).toBe(128);
    expect(result.rangeKph[0]).toBeLessThan(result.launchKph);
    expect(result.rangeKph[1]).toBeGreaterThan(result.launchKph);
  });
  it.each([
    ['near', 'left'],
    ['near', 'right'],
    ['nearService', 'left'],
    ['nearService', 'right']
  ] as const)('detects the %s %s half and the lone support in a cropped portrait image', (key, side) => {
    const { input, ground } = scene(300, side === 'right' ? 550 : 430);
    ground(key, side);
    delete input.setup.lines[key === 'near' ? 'nearService' : 'near'];
    delete input.setup.lines[side === 'right' ? 'netA' : 'netB'];
    // A/B are user labels, not fixed physical sides.
    if (side === 'right') {
      input.setup.lines.netA = input.setup.lines.netB;
      delete input.setup.lines.netB;
    }
    const before = JSON.stringify(input);
    const result = estimateServe(input);
    expect(result.camera.mapping?.halves[key]).toBe(side);
    expect(Object.values(result.camera.mapping!.supports)).toEqual([side]);
    expect(result.contact3D[2]).toBeCloseTo(2.6, 5);
    expect(result.launchKph).toBeCloseTo(reconstruct(Math.hypot(2, 19.6), 0.55, 2.6).kph, 4);
    expect(JSON.stringify(input)).toBe(before);
  });
  it('resolves two different near halves using the full far references', () => {
    const { input, ground } = scene();
    ground('near', 'left');
    ground('nearService', 'right');
    const result = estimateServe(input);
    expect(result.camera.mapping?.halves).toEqual({ near: 'left', nearService: 'right' });
    expect(result.camera.coverage).toEqual({ groundLines: 4, netLines: 3, halfLines: 2 });
    expect(result.variants).toBe(144);
  });
  it('requires enough ground depths, a centre strap and an independent side support', () => {
    const { input, ground } = scene();
    delete input.setup.lines.near;
    delete input.setup.lines.nearService;
    expect(() => calibrate(input.setup, 1280, 720)).toThrow(/three/);
    ground('near');
    delete input.setup.lines.netCenter;
    expect(() => calibrate(input.setup, 1280, 720)).toThrow(/net centre/);
    const other = scene().input;
    delete other.setup.lines.netA;
    delete other.setup.lines.netB;
    expect(() => calibrate(other.setup, 1280, 720)).toThrow(/side support/);
  });
  it('requires full far reference lines for automatic half detection', () => {
    const { input, ground } = scene();
    ground('near', 'left');
    delete input.setup.lines.service;
    expect(() => calibrate(input.setup, 1280, 720)).toThrow(/full far/);
    ground('service', 'left');
    expect(() => calibrate(input.setup, 1280, 720)).toThrow(/full far/);
  });
  it('rejects declaring a full observed line to be a half line', () => {
    const { input } = scene();
    input.setup.lines.near!.span = 'half';
    expect(() => calibrate(input.setup, 1280, 720)).toThrow(/Court mapping|ambiguous/);
  });
  it('does not invent an unobserved half or post in exported annotations', () => {
    const { input, ground } = scene(300, 550);
    ground('nearService', 'right');
    delete input.setup.lines.near;
    delete input.setup.lines.netA;
    const camera = calibrate(input.setup, input.width, input.height);
    const data = serveSpeedData({
      section: 'serve-speed',
      calibration: camera,
      clip: {
        id: 'portrait',
        name: 'serve.mov',
        contact: 10,
        index: input.index,
        sourceWidth: 300,
        sourceHeight: 720,
        speed: 1,
        mirrored: true,
        serve: input.setup
      }
    });
    expect(data.courtMarks).toHaveLength(5);
    expect(data.courtMarks.find((m) => m.id === 'near')).toBeUndefined();
    expect(data.courtMarks.find((m) => m.id === 'nearService')).toMatchObject({
      span: 'half',
      detectedHalf: 'right',
      courtPointsMeters: [
        [0, 5.485, 0],
        [4.115, 5.485, 0]
      ]
    });
    expect(data.calibration?.mapping?.supports).toEqual({ netB: 'right' });
  });
  it('keeps a noisy partial mapping consistent and encloses the known speed', () => {
    const { input, ground } = scene(300, 550);
    ground('nearService', 'right');
    delete input.setup.lines.near;
    delete input.setup.lines.netA;
    let n = 0;
    for (const line of Object.values(input.setup.lines))
      for (const p of line!.points) {
        p.x += Math.sin(++n * 13.7) / input.width;
        p.y += Math.cos(n * 8.1) / input.height;
      }
    const result = estimateServe(input),
      truth = reconstruct(Math.hypot(2, 19.6), 0.55, 2.6).kph;
    expect(result.camera.mapping?.halves.nearService).toBe('right');
    expect(result.camera.rms).toBeLessThan(1.5);
    expect(result.rangeKph[0]).toBeLessThan(truth);
    expect(result.rangeKph[1]).toBeGreaterThan(truth);
    expect(estimateServe(input)).toEqual(result);
  });
  it('fits a rolled portrait view with a tilted centre strap and half line', () => {
    const { input, ground } = scene(380, 480);
    ground('nearService', 'right');
    delete input.setup.lines.near;
    delete input.setup.lines.netA;
    const rotate = (p: { x: number; y: number }) => {
      const x = (p.x - 0.5) * input.width,
        y = (p.y - 0.5) * input.height;
      p.x = 0.5 + (x * Math.cos(0.06) - y * Math.sin(0.06)) / input.width;
      p.y = 0.5 + (x * Math.sin(0.06) + y * Math.cos(0.06)) / input.height;
    };
    Object.values(input.setup.lines).forEach((line) => line!.points.forEach(rotate));
    rotate(input.setup.contact!);
    rotate(input.setup.bounce!);
    const result = estimateServe(input);
    expect(result.contact3D[2]).toBeCloseTo(2.6, 5);
    expect(result.camera.mapping?.halves.nearService).toBe('right');
  });
  it('rejects a symmetric ambiguous half instead of selecting an arbitrary side', () => {
    const { input, p } = scene();
    delete input.setup.lines.nearService;
    input.setup.lines.near = {
      frame: 0,
      span: 'half',
      pixelFloor: 1,
      points: [project(p, [-2.0575, 0, 0]), project(p, [2.0575, 0, 0])]
    };
    input.setup.pixelError = 5;
    expect(() => calibrate(input.setup, input.width, input.height)).toThrow(/ambiguous/);
  });
});

/** The centre segment is a measured 6.4 m longitudinal reference. Its first
 * endpoint is the near service T, second the ground below the net centre. */
function centreScene(width = 1280, offset = 0) {
  const fixture = scene(width, offset);
  fixture.input.setup.lines.nearCenter = {
    frame: 5,
    pixelFloor: 1,
    points: [
      project(fixture.p, [0, COURT.nearService, 0]),
      project(fixture.p, [0, COURT.net, 0])
    ]
  };
  return fixture;
}
describe('near centre service reference', () => {
  it.each(GROUND_KEYS)('calibrates with the centre segment, full %s and only one support', (kept) => {
    for (const support of ['netA', 'netB'] as const) {
      const { input } = centreScene();
      for (const key of GROUND_KEYS) if (key !== kept) delete input.setup.lines[key];
      delete input.setup.lines[support === 'netA' ? 'netB' : 'netA'];
      expect(courtRequirement(input.setup)).toBeUndefined();
      const camera = calibrate(input.setup, input.width, input.height);
      expect(camera.rms).toBeLessThan(1e-6);
      expect(camera.coverage).toEqual({ groundLines: 2, netLines: 2, halfLines: 0 });
      expect(camera.controls).toHaveLength(8);
      expect(camera.mapping?.supports[support]).toBe(support === 'netA' ? 'left' : 'right');
      expect(atDepth(camera.p, input.setup.contact!, 0.4)[2]).toBeCloseTo(2.6, 5);
    }
  });
  it('estimates a cropped portrait serve with no near baseline or near service-width marks', () => {
    const { input } = centreScene(300, 550);
    delete input.setup.lines.near;
    delete input.setup.lines.nearService;
    delete input.setup.lines.service;
    delete input.setup.lines.netA;
    const result = estimateServe(input);
    const truth = reconstruct(Math.hypot(2, 19.6), 0.55, 2.6).kph;
    expect(result.launchKph).toBeCloseTo(truth, 4);
    expect(result.rangeKph[0]).toBeLessThan(truth);
    expect(result.rangeKph[1]).toBeGreaterThan(truth);
    const data = serveSpeedData({
      section: 'serve-speed', result,
      clip: {
        id: 'centre', name: 'serve.mov', contact: 10, index: input.index,
        sourceWidth: input.width, sourceHeight: input.height, speed: 1,
        mirrored: true, serve: input.setup
      }
    });
    expect(data.courtMarks.find((m) => m.id === 'nearCenter')).toMatchObject({
      span: 'centre', pointsNormalized: input.setup.lines.nearCenter!.points,
      courtPointsMeters: [[0, 5.485, 0], [0, 11.885, 0]]
    });
    expect(data.courtMarks).toHaveLength(4);
    expect(data.courtDimensionsMeters.nearCentreServiceLength).toBeCloseTo(6.4);
  });
  it('uses the centre segment alongside all existing references and near half-widths', () => {
    const { input, ground } = centreScene();
    ground('near', 'left');
    ground('nearService', 'right');
    const camera = calibrate(input.setup, input.width, input.height);
    expect(camera.mapping?.halves).toEqual({ near: 'left', nearService: 'right' });
    expect(camera.coverage).toEqual({ groundLines: 5, netLines: 3, halfLines: 2 });
    expect(camera.controls?.filter((c) => c.mark === 'nearCenter').map((c) => c.world))
      .toEqual([[0, 5.485, 0], [0, 11.885, 0]]);
    expect(camera.residuals.find((r) => r.mark === 'nearCenter')!.pixels).toBeLessThan(1e-6);
  });
  it('retains uncertainty on a noisy reduced centre-line mapping', () => {
    const { input } = centreScene(300, 550);
    delete input.setup.lines.near;
    delete input.setup.lines.nearService;
    delete input.setup.lines.service;
    delete input.setup.lines.netA;
    let n = 0;
    for (const mark of Object.values(input.setup.lines))
      for (const point of mark!.points) {
        point.x += Math.sin(++n * 13.7) / input.width;
        point.y += Math.cos(n * 8.1) / input.height;
      }
    const result = estimateServe(input);
    const truth = reconstruct(Math.hypot(2, 19.6), 0.55, 2.6).kph;
    expect(result.camera.rms).toBeLessThan(1.5);
    expect(result.rangeKph[0]).toBeLessThan(truth);
    expect(result.rangeKph[1]).toBeGreaterThan(truth);
  });
  it('still requires width and elevated net references, and preserves half-line inference rules', () => {
    const { input, ground } = centreScene();
    GROUND_KEYS.forEach((key) => { delete input.setup.lines[key]; });
    expect(courtRequirement(input.setup)).toMatch(/far baseline/);
    ground('far');
    delete input.setup.lines.netCenter;
    expect(courtRequirement(input.setup)).toMatch(/net centre/);
    const other = centreScene();
    delete other.input.setup.lines.netA;
    delete other.input.setup.lines.netB;
    expect(courtRequirement(other.input.setup)).toBeUndefined();
    delete other.input.setup.lines.nearCenter;
    expect(courtRequirement(other.input.setup)).toMatch(/side support/);
    const half = centreScene();
    half.ground('near', 'left');
    delete half.input.setup.lines.service;
    expect(courtRequirement(half.input.setup)).toBeUndefined();
    delete half.input.setup.lines.nearCenter;
    expect(courtRequirement(half.input.setup)).toMatch(/full far/);
  });
  it('rejects a half or collapsed centre segment and a reversed full segment', () => {
    const { input } = centreScene();
    input.setup.lines.nearCenter!.span = 'half';
    expect(courtRequirement(input.setup)).toMatch(/complete near centre/);
    delete input.setup.lines.nearCenter!.span;
    const ends = input.setup.lines.nearCenter!.points;
    input.setup.lines.nearCenter!.points = [ends[0], ends[0]];
    expect(() => calibrate(input.setup, input.width, input.height)).toThrow(/too short/);
    input.setup.lines.nearCenter!.points = [ends[1], ends[0]];
    expect(() => calibrate(input.setup, input.width, input.height)).toThrow(/Court mapping/);
  });
});

describe('centre reference with optional near half-widths', () => {
  it.each([['near', 'left'], ['near', 'right'], ['nearService', 'left'], ['nearService', 'right']] as const)(
    'infers the %s %s half without requiring an extra far service line', (key, side) => {
      const { input, ground } = centreScene(300, side === 'right' ? 550 : 430);
      ground(key, side);
      delete input.setup.lines[key === 'near' ? 'nearService' : 'near'];
      delete input.setup.lines.service;
      delete input.setup.lines[side === 'right' ? 'netA' : 'netB'];
      const camera = calibrate(input.setup, input.width, input.height);
      expect(camera.mapping?.halves[key]).toBe(side);
      expect(camera.rms).toBeLessThan(1e-6);
      expect(atDepth(camera.p, input.setup.contact!, 0.4)[2]).toBeCloseTo(2.6, 5);
    }
  );
});


function fourLines(key: GroundLine, side: 'left' | 'right', width = 1280, offset = 0) {
  const fixture = centreScene(width, offset);
  fixture.ground(key, side);
  const other = key === 'far' ? 'service' : 'far';
  fixture.ground(other, side);
  for (const ground of GROUND_KEYS) if (ground !== key && ground !== other) delete fixture.input.setup.lines[ground];
  delete fixture.input.setup.lines.netA;
  delete fixture.input.setup.lines.netB;
  return fixture;
}
describe('four-line metric camera calibration', () => {
  it('requires a separate far baseline and another transverse line in reduced mode', () => {
    const { input } = fourLines('nearService', 'right');
    delete input.setup.lines.far;
    expect(courtRequirement(input.setup)).toMatch(/far baseline and one other/);
    const onlyFar = fourLines('far', 'left').input;
    delete onlyFar.setup.lines.service;
    expect(courtRequirement(onlyFar.setup)).toMatch(/far baseline and one other/);
  });
  it.each(GROUND_KEYS.flatMap(key => (['left', 'right'] as const).map(side => [key, side] as const)))(
    'recovers camera height and the %s %s half without invented net posts', (key, side) => {
      const { input } = fourLines(key, side);
      const camera = calibrate(input.setup, input.width, input.height);
      expect(camera.reduced?.focalPixels).toBeCloseTo(700, 3);
      expect(camera.reduced?.principal).toEqual({ x: 0.5, y: 0.5 });
      expect(camera.rms).toBeLessThan(1e-5);
      expect(camera.mapping?.halves[key]).toBe(side);
      expect(camera.mapping?.supports).toEqual({});
      expect(camera.controls).toHaveLength(8);
      expect(camera.controls?.some(c => c.mark === 'netA' || c.mark === 'netB')).toBe(false);
      expect(atDepth(camera.p, input.setup.contact!, 0.4)[2]).toBeCloseTo(2.6, 5);
    }
  );
  it.each(['nearService', 'far'] as const)('estimates speed from %s half and includes camera-assumption sensitivity', key => {
    const { input } = fourLines(key, 'right');
    const result = estimateServe(input);
    const truth = reconstruct(Math.hypot(2, 19.6), 0.55, 2.6).kph;
    expect(result.launchKph).toBeCloseTo(truth, 4);
    expect(result.rangeKph[0]).toBeLessThan(truth);
    expect(result.rangeKph[1]).toBeGreaterThan(truth);
    expect(result.variants).toBe(128);
    const exported = serveSpeedData({ section: 'serve-speed', result, clip: {
      id: 'minimal', name: 'serve.mov', contact: 10, index: input.index,
      sourceWidth: input.width, sourceHeight: input.height, speed: 1, serve: input.setup
    } });
    expect(exported.calibrationModel?.name).toBe('reduced-pinhole');
    expect(exported.courtMarks).toHaveLength(4);
    expect(exported.courtMarks.find(m => m.id === key)?.detectedHalf).toBe('right');
  });
  it('includes the reference speed in a mildly off-centre portrait crop', () => {
    const { input } = fourLines('far', 'right', 300, 550);
    const result = estimateServe(input);
    const truth = reconstruct(Math.hypot(2, 19.6), 0.55, 2.6).kph;
    expect(result.rangeKph[0]).toBeLessThan(truth);
    expect(result.rangeKph[1]).toBeGreaterThan(truth);
    expect(result.camera.reduced).toBeDefined();
  });
  it('keeps modest pixel noise in the uncertainty envelope', () => {
    const { input } = fourLines('far', 'left');
    let n = 0;
    for (const mark of Object.values(input.setup.lines)) for (const point of mark!.points) {
      point.x += Math.sin(++n * 13.7) * 0.6 / input.width;
      point.y += Math.cos(n * 8.1) * 0.6 / input.height;
    }
    const result = estimateServe(input);
    const truth = reconstruct(Math.hypot(2, 19.6), 0.55, 2.6).kph;
    expect(result.camera.rms).toBeLessThan(1);
    expect(result.rangeKph[0]).toBeLessThan(truth);
    expect(result.rangeKph[1]).toBeGreaterThan(truth);
  });
  it('uses full projective calibration with extra full-width and post evidence, including far halves', () => {
    const { input, ground } = centreScene();
    ground('far', 'left');
    ground('service', 'right');
    const camera = calibrate(input.setup, input.width, input.height);
    expect(camera.reduced).toBeUndefined();
    expect(camera.mapping?.halves).toEqual({ far: 'left', service: 'right' });
    expect(camera.rms).toBeLessThan(1e-6);
  });
  it('rejects missing, collapsed or ambiguous minimum references', () => {
    const { input } = fourLines('far', 'right');
    delete input.setup.lines.netCenter;
    expect(courtRequirement(input.setup)).toMatch(/net centre/);
    const flat = fourLines('nearService', 'right').input;
    flat.setup.lines.nearService!.points[1] = flat.setup.lines.nearService!.points[0];
    expect(() => calibrate(flat.setup, flat.width, flat.height)).toThrow();
    const ambiguous = fourLines('far', 'right').input;
    ambiguous.setup.pixelError = 30;
    expect(() => calibrate(ambiguous.setup, ambiguous.width, ambiguous.height, false)).toThrow(/ambiguous/);
  });
});


describe('sparse camera orientation and additional evidence', () => {
  it('handles a rolled, off-axis camera using independent view geometry', () => {
    const { input } = fourLines('service', 'left');
    const eye = [3, -12, 5], forward = [-3, 24, -5];
    const normalize = (v: number[]) => v.map(n => n / Math.hypot(...v));
    const cross = (a: number[], b: number[]) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    const z = normalize(forward), right = normalize(cross(z, [0,0,1])), down = cross(z, right);
    const roll = 0.08, f = 900;
    const axes = [right.map((v, i) => Math.cos(roll)*v+Math.sin(roll)*down[i]),
      down.map((v, i) => Math.cos(roll)*v-Math.sin(roll)*right[i]), z];
    const r = axes.map(a => [...a, -a.reduce((sum, v, i) => sum + v * eye[i], 0)]);
    const p = [r[0].map((v,i) => f/1280*v + .5*r[2][i]),
      r[1].map((v,i) => f/720*v + .5*r[2][i]), r[2]];
    input.setup.lines.service!.points = [project(p, [-4.115,18.285,0]),project(p,[0,18.285,0])];
    input.setup.lines.far!.points = [project(p,[-4.115,23.77,0]),project(p,[0,23.77,0])];
    input.setup.lines.nearCenter!.points = [project(p,[0,5.485,0]),project(p,[0,11.885,0])];
    input.setup.lines.netCenter!.points = [project(p,[0,11.885,.914]),project(p,[0,11.885,0])];
    const camera = calibrate(input.setup,1280,720);
    expect(camera.mapping?.halves.service).toBe('left');
    expect(camera.reduced?.focalPixels).toBeCloseTo(f,3);
    expect(atDepth(camera.p,project(p,[-1,.4,2.6]),.4)[2]).toBeCloseTo(2.6,5);
  });
  it('accepts a full-width reference as well as a half, and upgrades with a side support', () => {
    const { input, ground, p } = fourLines('far', 'right');
    ground('far');
    expect(calibrate(input.setup, input.width,input.height).reduced).toBeDefined();
    input.setup.lines.netA = { frame: 4, pixelFloor: 1,
      points: [project(p,[-6.399,11.885,1.07]),project(p,[-6.399,11.885,0])] };
    const camera = calibrate(input.setup,input.width,input.height);
    expect(camera.reduced).toBeUndefined();
    expect(camera.mapping?.supports.netA).toBe('left');
  });
});
