import { describe, expect, it } from 'vitest';
import { atHeight, calibrate, COURT, project } from '../src/video-comparison/speed/geometry';
import { flight, reconstruct } from '../src/video-comparison/speed/physics';
import { estimateServe } from '../src/video-comparison/speed/estimate';
import { newServeSetup, type SpeedInput } from '../src/video-comparison/speed/types';

// Independent pinhole camera: 1280 × 720, 700 px focal length, looking from
// (0, -14, 10) toward (0, 12, 0). No reconstruction/calibration code builds P.
export function fixture(reverse = false): SpeedInput {
  const length = Math.hypot(26, 10),
    c = 26 / length,
    s = 10 / length;
  const depth = 14 * c + 10 * s;
  const p = [
    [700 / 1280, 0.5 * c, -0.5 * s, 0.5 * depth],
    [0, (-700 / 720) * s + 0.5 * c, (-700 / 720) * c - 0.5 * s, (-700 / 720) * (14 * s - 10 * c) + 0.5 * depth],
    [0, c, -s, depth]
  ];
  const setup = newServeSetup(),
    pair = (y: number, z = 0, x = COURT.halfWidth) => [project(p, [-x, y, z]), project(p, [x, y, z])] as const;
  setup.lines = {
    near: [...pair(0)],
    far: [...pair(COURT.length)],
    service: [...pair(COURT.farService)],
    net: [...pair(COURT.net, COURT.postHeight, 6.399)]
  };
  setup.netCenter = project(p, [0, COURT.net, COURT.centerHeight]);
  setup.courtFrame = 0;
  setup.stationary = true;
  const contact = [-1, reverse ? 23.37 : 0.4, 2.6],
    bounce = [1, reverse ? 3.77 : 20, COURT.ballRadius];
  setup.contact = { ...project(p, contact), frame: 10, radius: 0 };
  setup.bounce = { ...project(p, bounce), frame: 43, radius: 0 };
  return {
    setup,
    width: 1280,
    height: 720,
    contact: 10,
    start: 0,
    end: 89,
    index: { timestamps: Float64Array.from({ length: 90 }, (_, i) => i / 60), end: 1.5, fps: 60, variable: false }
  };
}

describe('metric court and airborne calibration', () => {
  it('recovers contact and first bounce using independent height constraints', () => {
    const input = fixture(),
      camera = calibrate(input.setup, input.width, input.height);
    expect(camera.rms).toBeLessThan(1e-7);
    expect(camera.checkError).toBeLessThan(1e-7);
    const contact = atHeight(camera.p, input.setup.contact!, 2.6);
    expect(contact[0]).toBeCloseTo(-1, 7);
    expect(contact[1]).toBeCloseTo(0.4, 7);
    expect(atHeight(camera.p, input.setup.bounce!, COURT.ballRadius)[1]).toBeCloseTo(20, 7);
    // A ground homography on an airborne ball gives the wrong depth.
    expect(Math.abs(atHeight(camera.p, input.setup.contact!, 0)[1] - 0.4)).toBeGreaterThan(2);
  });
  it('rejects crossed/degenerate courts and independent check disagreements', () => {
    const input = fixture();
    input.setup.lines.far!.reverse();
    expect(() => calibrate(input.setup, 1280, 720)).toThrow(/quadrilateral/);
    const bad = fixture();
    bad.setup.lines.service![0].y += 0.03;
    expect(() => calibrate(bad.setup, 1280, 720)).toThrow(/check marks/);
    const net = fixture();
    net.setup.netCenter!.y += 0.03;
    expect(() => calibrate(net.setup, 1280, 720)).toThrow(/check marks/);
  });
});

describe('deterministic launch reconstruction', () => {
  it('matches the analytic no-drag solution', () => {
    const d = 20,
      t = 0.55,
      h = 2.6,
      z = COURT.ballRadius;
    const result = reconstruct(d, t, h, z, 0);
    expect(result.velocity[0]).toBeCloseTo(d / t, 7);
    expect(result.velocity[1]).toBeCloseTo((z - h) / t + (9.81 * t) / 2, 7);
    expect(result.q[1]).toBeCloseTo(z, 7);
  });
  it.each([-0.004, 0, 0.004])('recovers known velocities with quadratic drag and lift %s', (lift) => {
    const measured = flight(48, -2, 2.8, 0.5, 0.02, lift);
    const result = reconstruct(measured.q[0], 0.5, 2.8, measured.q[1], 0.02, lift);
    expect(result.velocity[0]).toBeCloseTo(48, 4);
    expect(result.velocity[1]).toBeCloseTo(-2, 4);
  });
  it.each([false, true])(
    'estimates a serve from either end, with a deterministic uncertainty envelope (%s)',
    (reverse) => {
      const input = fixture(reverse),
        before = JSON.stringify(input),
        result = estimateServe(input);
      const expected = reconstruct(Math.hypot(2, 19.6), 0.55, 2.6);
      expect(result.launchKph).toBeCloseTo(expected.kph, 4);
      expect(result.rangeKph[0]).toBeLessThan(result.launchKph);
      expect(result.rangeKph[1]).toBeGreaterThan(result.launchKph);
      expect(result.horizontalMeanKph).toBeLessThan(result.launchKph);
      expect(result.netClearance).toBeGreaterThan(0);
      expect(result).toEqual(estimateServe(input));
      expect(JSON.stringify(input)).toBe(before);
    }
  );
  it('uses source PTS and explicit recording slowdown, not playback controls', () => {
    const input = fixture(),
      expected = estimateServe(input);
    input.index = {
      ...input.index,
      timestamps: input.index.timestamps.map((t, i) => t * 4 + (i > 10 && i < 43 ? 0.001 * (i % 3) : 0)),
      end: input.index.end * 4,
      variable: true
    };
    input.setup.slowdown = 4;
    expect(estimateServe(input).launchKph).toBeCloseTo(expected.launchKph, 5);
  });
  it('uses intermediate marks as independent flight checks', () => {
    const input = fixture(),
      result = estimateServe(input),
      i = 20;
    const time = input.index.timestamps[i] - input.index.timestamps[input.contact!];
    const n = (time / result.flightSeconds) * (result.path.length - 1),
      a = result.path[Math.floor(n)],
      b = result.path[Math.ceil(n)];
    const f = n % 1;
    input.setup.flight = [{ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, frame: i, radius: 0 }];
    expect(estimateServe(input).flightRms).toBeLessThan(1e-6);
    input.setup.flight[0].x += 0.03;
    expect(() => estimateServe(input)).toThrow(/flight checks disagree/);
  });
  it('accepts frame zero and rejects a bounce trimmed out of the excerpt', () => {
    const input = fixture(),
      expected = estimateServe(input).launchKph;
    input.contact = input.setup.contact!.frame = 0;
    input.setup.bounce!.frame = 33;
    expect(estimateServe(input).launchKph).toBeCloseTo(expected, 6);
    input.end = 32;
    expect(() => estimateServe(input)).toThrow(/inside the excerpt/);
  });
  it('detects an earlier net collision rather than reporting an unobstructed flight', () => {
    const input = fixture(),
      camera = calibrate(input.setup, input.width, input.height);
    input.setup.height = 1.1;
    input.setup.heightError = 0.1;
    input.setup.contact = { ...project(camera.p, [-1, 0.4, 1.1]), frame: input.contact!, radius: 0 };
    input.setup.bounce!.frame = input.contact! + 18;
    expect(() => estimateServe(input)).toThrow(/net or ground before/);
  });
  it('propagates the size of a marked ball region into the speed envelope', () => {
    const input = fixture();
    input.setup.heightError = 0;
    input.setup.dragError = 0;
    input.setup.liftError = 0;
    const precise = estimateServe(input);
    input.setup.contact!.radius = input.setup.bounce!.radius = 6;
    const region = estimateServe(input);
    expect(region.rangeKph[1] - region.rangeKph[0]).toBeGreaterThan(precise.rangeKph[1] - precise.rangeKph[0]);
    expect(region.launchKph).toBe(precise.launchKph);
  });
  it('refuses missing, stale, portrait, collision and malformed evidence', () => {
    const a = fixture();
    a.width = 600;
    expect(() => estimateServe(a)).toThrow(/landscape/);
    const b = fixture();
    b.contact = 11;
    expect(() => estimateServe(b)).toThrow(/selected contact/);
    const c = fixture();
    c.setup.bounce!.frame = 10;
    expect(() => estimateServe(c)).toThrow(/first bounce/);
    const d = fixture();
    d.setup.stationary = false;
    expect(() => estimateServe(d)).toThrow(/fixed camera/);
    const e = fixture();
    e.setup.height = 1.1;
    e.setup.heightError = 0.1;
    expect(() => estimateServe(e)).toThrow();
    const f = fixture();
    f.setup.slowdown = NaN;
    expect(() => estimateServe(f)).toThrow(/assumptions/);
  });
});
