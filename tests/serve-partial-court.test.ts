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
    expect(() => calibrate(input.setup, 1280, 720)).toThrow(/full singles width/);
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
