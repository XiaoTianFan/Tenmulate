import { describe, expect, it } from 'vitest';
import { atHeight, atDepth, calibrate, COURT, project } from '../src/video-comparison/speed/geometry';
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
    near: { points: [...pair(0)], frame: 0, pixelFloor: 1 },
    far: { points: [...pair(COURT.length)], frame: 1, pixelFloor: 1 },
    service: { points: [...pair(COURT.farService)], frame: 2, pixelFloor: 1 },
    netA: {
      points: [project(p, [-6.399, COURT.net, COURT.postHeight]), project(p, [-6.399, COURT.net, 0])],
      frame: 3,
      pixelFloor: 1
    },
    netB: {
      points: [project(p, [6.399, COURT.net, COURT.postHeight]), project(p, [6.399, COURT.net, 0])],
      frame: 4,
      pixelFloor: 1
    },
    netCenter: {
      points: [project(p, [0, COURT.net, COURT.centerHeight]), project(p, [0, COURT.net, 0])],
      frame: 5,
      pixelFloor: 1
    }
  };
  setup.contactDepth = 0.4;
  setup.servingEnd = reverse ? 'far' : 'near';
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
  it('recovers automatic contact height at an independently assumed depth', () => {
    const input = fixture(),
      camera = calibrate(input.setup, input.width, input.height);
    expect(camera.rms).toBeLessThan(1e-7);
    expect(camera.checkError).toBeLessThan(1e-7);
    const contact = atDepth(camera.p, input.setup.contact!, 0.4);
    expect(contact[0]).toBeCloseTo(-1, 7);
    expect(contact[1]).toBeCloseTo(0.4, 7);
    expect(contact[2]).toBeCloseTo(2.6, 7);
    expect(atHeight(camera.p, input.setup.bounce!, COURT.ballRadius)[1]).toBeCloseTo(20, 7);
    // A ground homography on an airborne ball gives the wrong depth.
    expect(Math.abs(atHeight(camera.p, input.setup.contact!, 0)[1] - 0.4)).toBeGreaterThan(2);
  });
  it('rejects crossed courts, gross mismatches and collapsed net heights', () => {
    const input = fixture();
    input.setup.lines.far!.points.reverse();
    expect(() => calibrate(input.setup, 1280, 720)).toThrow(/quadrilateral/);
    const bad = fixture();
    bad.setup.lines.service!.points[0].y += 0.03;
    expect(() => calibrate(bad.setup, 1280, 720)).toThrow(/Court mapping/);
    const net = fixture();
    net.setup.lines.netCenter!.points[0].y += 0.03;
    expect(() => calibrate(net.setup, 1280, 720)).toThrow(/vertical line/);
  });
  it('uses every ground and elevated endpoint with marks on different source frames', () => {
    const input = fixture(),
      expected = estimateServe(input);
    const frames = Object.values(input.setup.lines).map((m) => m!.frame);
    expect(new Set(frames).size).toBe(6);
    [input.setup.lines.netA, input.setup.lines.netB] = [input.setup.lines.netB, input.setup.lines.netA];
    expect(estimateServe(input).launchKph).toBeCloseTo(expected.launchKph, 6);
    // Moving a previously unused ground foot now changes the fitted camera.
    input.setup.lines.netA!.points[1].y += 3 / 720;
    const camera = calibrate(input.setup, 1280, 720);
    expect(camera.rms).toBeGreaterThan(0.1);
    expect(atDepth(camera.p, input.setup.contact!, 0.4)[2]).not.toBeCloseTo(2.6, 3);
  });
  it.each([1, 2, 3, 4])('handles ordinary %s-pixel marking noise without a calibration failure', (noise) => {
    const input = fixture();
    let i = 0;
    for (const m of Object.values(input.setup.lines))
      for (const p of m!.points) {
        p.x += (Math.sin(++i * 13.7) * noise) / 1280;
        p.y += (Math.cos(i * 8.1) * noise) / 720;
      }
    const camera = calibrate(input.setup, 1280, 720);
    expect(camera.rms).toBeLessThan(noise * 1.5);
    expect(Math.abs(atDepth(camera.p, input.setup.contact!, 0.4)[2] - 2.6)).toBeLessThan(0.4);
  });
  it('identifies a modest isolated mismatch for review and expands uncertainty', () => {
    const input = fixture();
    input.setup.lines.service!.points[0].y += 10 / 720;
    const camera = calibrate(input.setup, 1280, 720);
    expect(camera.quality).toBe('review');
    expect(camera.worstMark).toBe('service');
    expect(camera.pixelError).toBeGreaterThan(input.setup.pixelError);
    const result = estimateServe(input);
    expect(result.rangeKph[0]).toBeLessThan(result.launchKph);
    expect(result.rangeKph[1]).toBeGreaterThan(result.launchKph);
  });
  it('reports which landmark is inconsistent instead of a generic calibration error', () => {
    const input = fixture();
    input.setup.lines.service!.points[0].y += 50 / 720;
    expect(() => calibrate(input.setup, 1280, 720)).toThrow(/Court mapping disagrees most/);
    try {
      calibrate(input.setup, 1280, 720);
    } catch (error) {
      expect(error).toMatchObject({ mark: 'service' });
    }
  });
  it('calibrates physically vertical net segments that lean in a rolled image', () => {
    const input = fixture(),
      angle = 0.12;
    const rotate = (p: { x: number; y: number }) => {
      const x = (p.x - 0.5) * 1280,
        y = (p.y - 0.5) * 720;
      p.x = 0.5 + (x * Math.cos(angle) - y * Math.sin(angle)) / 1280;
      p.y = 0.5 + (x * Math.sin(angle) + y * Math.cos(angle)) / 720;
    };
    for (const m of Object.values(input.setup.lines)) for (const p of m!.points) rotate(p);
    rotate(input.setup.contact!);
    rotate(input.setup.bounce!);
    expect(
      Math.abs(input.setup.lines.netCenter!.points[0].x - input.setup.lines.netCenter!.points[1].x)
    ).toBeGreaterThan(0.001);
    const result = estimateServe(input);
    expect(result.contact3D[2]).toBeCloseTo(2.6, 6);
    expect(result.launchKph).toBeCloseTo(reconstruct(Math.hypot(2, 19.6), 0.55, 2.6).kph, 4);
  });
  it('does not silently accept the wrong net support spacing', () => {
    const input = fixture();
    input.setup.netSupports = 'singles';
    expect(() => calibrate(input.setup, 1280, 720)).toThrow(/Court mapping/);
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
      expect(result.contact3D[2]).toBeCloseTo(2.6, 6);
      expect(result.contactHeightRange[0]).toBeLessThan(2.6);
      expect(result.contactHeightRange[1]).toBeGreaterThan(2.6);
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
  it('recomputes height when the depth assumption changes, without a manual height input', () => {
    const input = fixture(),
      first = estimateServe(input);
    input.setup.contactDepth = 1;
    const next = estimateServe(input);
    expect(next.contact3D[1]).toBe(1);
    expect(next.contact3D[2]).toBeLessThan(first.contact3D[2]);
    expect(input.setup).not.toHaveProperty('height');
    expect(input.setup).not.toHaveProperty('stationary');
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

    input.setup.contact = { ...project(camera.p, [-1, 0.4, 1.1]), frame: input.contact!, radius: 0 };
    input.setup.bounce!.frame = input.contact! + 18;
    expect(() => estimateServe(input)).toThrow(/net or ground before/);
  });
  it('propagates the size of a marked ball region into the speed envelope', () => {
    const input = fixture();
    input.setup.depthError = 0;
    input.setup.dragError = 0;
    input.setup.liftError = 0;
    const precise = estimateServe(input);
    input.setup.contact!.radius = input.setup.bounce!.radius = 6;
    const region = estimateServe(input);
    expect(region.rangeKph[1] - region.rangeKph[0]).toBeGreaterThan(precise.rangeKph[1] - precise.rangeKph[0]);
    expect(region.launchKph).toBe(precise.launchKph);
  });
  it('refuses missing, stale, collision and malformed evidence', () => {
    const a = fixture();
    a.width = 0;
    expect(() => estimateServe(a)).toThrow(/dimensions/);
    const b = fixture();
    b.contact = 11;
    expect(() => estimateServe(b)).toThrow(/selected contact/);
    const c = fixture();
    c.setup.bounce!.frame = 10;
    expect(() => estimateServe(c)).toThrow(/first bounce/);
    const d = fixture();
    d.setup.lines.netA!.frame = -1;
    expect(() => estimateServe(d)).toThrow(/valid source frame/);
    const e = fixture();
    e.setup.servingEnd = 'far';
    expect(() => estimateServe(e)).toThrow();
    const f = fixture();
    f.setup.slowdown = NaN;
    expect(() => estimateServe(f)).toThrow(/assumptions/);
  });
});
