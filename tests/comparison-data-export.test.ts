import { describe, expect, it } from 'vitest';
import { motionAnalysisData, motionPlotsData } from '../src/video-comparison/dataExport/motion';
import { serveSpeedData } from '../src/video-comparison/dataExport/serve';
import { serializeData } from '../src/video-comparison/dataExport/common';
import type { DataClip } from '../src/video-comparison/dataExport/types';
import { emptySeries, newMotion, putSample, OBSERVED, ESTIMATED, MANUAL } from '../src/video-comparison/analysis/types';
import { plotData } from '../src/video-comparison/analysis/series';
import { reconstructTrajectory } from '../src/video-comparison/analysis/trajectory';
import { stabilizePose } from '../src/video-comparison/analysis/stabilizePose';
import { createFrameIndex } from '../src/video-comparison/timeline';
import { newServeSetup, type SpeedResult } from '../src/video-comparison/speed/types';

function fixture(): DataClip {
  const times = [0, 0.02, 0.05, 0.081, 0.12, 0.17, 0.22];
  const index = createFrameIndex(times.map((timestamp) => ({ timestamp, duration: 0.02 })));
  const track = emptySeries(0, times.length - 1, 1, 1000, 500, 'fixture');
  times.forEach((time, frame) =>
    putSample(track, frame, 0, (100 + 30 * time + 20 * time ** 2) / 1000, (50 + 40 * time) / 500, 0.9)
  );
  track.states[2] = ESTIMATED;
  const motion = newMotion();
  motion.tracks = [
    {
      id: 'ball',
      name: '网球 💛',
      color: '#fff',
      revision: 1,
      visible: false,
      anchors: [{ frame: 0, x: 0.1, y: 0.1, width: 0.02, height: 0.04, role: 'start' }],
      result: track
    }
  ];
  motion.plots = [{ id: 'p', target: 'track:ball', metric: 'vx', smoothing: 0.2 }];
  return {
    id: 'clip',
    name: 'serve.mov',
    index,
    contact: 0,
    speed: 0.5,
    sourceWidth: 1000,
    sourceHeight: 500,
    trim: { start: 2, end: 4 },
    crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 },
    mirrored: true,
    motion
  };
}
describe('professional analysis-data exports', () => {
  it('exports source-frame VFR timing, annotations, original coordinates and every tracking metric without changing live data', () => {
    const clip = fixture(),
      before = serializeData(clip),
      data = motionAnalysisData(clip);
    const track = data.tracks[0],
      series = track.result!;
    expect(track.name).toBe('网球 💛');
    expect(track.visible).toBe(false);
    expect(track.anchors[0]).toMatchObject({
      frame: 0,
      displayFrame: 1,
      sourceTimeSeconds: 0,
      role: 'start',
      width: 0.02
    });
    expect(series.frame).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(series.sourceTimeSeconds[3]).toBe(0.081);
    expect(series.contactRelativeSourceSeconds[3]).toBe(0.081);
    expect(series.contactRelativeTimelineSeconds[3]).toBe(0.162);
    expect(series.coordinates.xNormalized[0]).toBeCloseTo(0.1, 6);
    expect(series.metrics.values.vx.values[3]).toBeCloseTo(30 + 40 * 0.081, 2);
    expect(series.metrics.values.vy.values[3]).toBeCloseTo(-40, 2);
    expect(series.metrics.values.ax.values[3]).toBeCloseTo(40, 1);
    expect(series.metrics.values.vx.estimated[3]).toBe(true);
    expect(series.metrics.values.y.values[3]).toBeCloseTo(500 - (50 + 40 * 0.081), 3);
    expect(Object.keys(series.metrics.values)).toHaveLength(9);
    expect(data.clip.presentation).toMatchObject({ playbackRate: 0.5, mirrored: true });
    expect(data.clip.excerpt.start.frame).toBe(2);
    expect(serializeData(clip)).toBe(before);
    const json = JSON.parse(serializeData(data));
    expect(Array.isArray(json.tracks[0].result.coordinates.state)).toBe(true);
    expect(json.clip.source.timestampsSeconds).toEqual(Array.from(clip.index.timestamps));
    expect(serializeData(data)).not.toContain('blob:');
  });
  it('keeps missing samples distinct from real zero coordinates and never joins gaps for path length', () => {
    const clip = fixture(),
      series = clip.motion!.tracks[0].result!;
    series.states.fill(0);
    putSample(series, 0, 0, 0, 0, 1, MANUAL);
    putSample(series, 1, 0, 0.003, 0.008, 1);
    putSample(series, 4, 0, 0.5, 0.5, 1);
    putSample(series, 5, 0, 0.503, 0.508, 0.15, ESTIMATED);
    const data = motionAnalysisData(clip).tracks[0].result!;
    expect(data.coordinates.xNormalized[0]).toBe(0);
    expect(data.coordinates.xNormalized[2]).toBeNull();
    expect(data.metrics.values.vx.values[2]).toBeNull();
    expect(data.trajectoryLength.totalPixels).toBeCloseTo(10, 3);
    expect(data.trajectoryLength.cumulativePixels[2]).toBeNull();
    expect(data.trajectoryLength.missingSegments).toBe(4);
    expect(data.trajectoryLength.estimatedSegments).toBe(1);
    expect(data.trajectoryLength.cumulativePixels[4]).toBeCloseTo(5, 3);
  });
  it('exports every plotted value at its chosen smoothing, including data outside chart/excerpt boundaries', () => {
    const clip = fixture(),
      plot = clip.motion!.plots[0];
    const expected = plotData(clip.motion!, plot, clip.index),
      data = motionPlotsData(clip).plots[0];
    expect(data.values).toEqual(expected.values);
    expect(data.estimated).toEqual(expected.estimated);
    expect(data.frame).toHaveLength(7);
    expect(data.smoothing).toBe(0.2);
    expect(data.unit).toBe('px/s');
    expect(data.target).toEqual({ kind: 'track', id: 'ball', name: '网球 💛' });
    clip.motion!.plots.push({ id: 'missing', target: 'joint:leftElbow', metric: 'angle', smoothing: 0.1 });
    expect(motionPlotsData(clip).plots[1]).toMatchObject({ status: 'no-result', values: [], frame: [] });
  });
  it('includes all landmarks/bones/joints, direct detections, interpolated evidence and angular rates with explicit gaps', () => {
    const clip = fixture(),
      raw = emptySeries(0, 6, 17, 1000, 500, 'pose-fixture');
    raw.detections = {
      values: new Float32Array(raw.values.length),
      states: new Uint8Array(raw.states.length),
      frames: [0, 1, 2, 3, 4, 5, 6]
    };
    clip.index.timestamps.forEach((time, frame) => {
      const angle = ((90 + time * 60) * Math.PI) / 180;
      putSample(raw, frame, 5, 0.4, 0.5, 0.9);
      putSample(raw, frame, 7, 0.5, 0.5, 0.9);
      putSample(raw, frame, 9, 0.5 - 0.1 * Math.cos(angle), 0.5 + 0.2 * Math.sin(angle), 0.9);
    });
    raw.detections.values.set(raw.values);
    raw.detections.states.set(raw.states);
    // A low-confidence detector output remains exportable but is not a valid plot sample.
    raw.detections.values.set([0.2, 0.3, 0.1], 0);
    raw.detections.states[0] = OBSERVED;
    clip.motion!.pose.result = stabilizePose(raw, clip.index, raw.detections.frames);
    clip.motion!.joints = ['leftElbow'];
    const pose = motionAnalysisData(clip).pose.result!;
    expect(pose.landmarks).toHaveLength(17);
    expect(pose.joints).toHaveLength(8);
    expect(pose.bones).toHaveLength(12);
    expect(pose.landmarks[0].detections!.confidence[0]).toBeCloseTo(0.1, 6);
    expect(pose.landmarks[0].coordinates.confidence[0]).toBeNull();
    expect(pose.landmarks[9].observationsBeforeStabilization!.state[3]).toBe(OBSERVED);
    const elbow = pose.joints.find((j) => j.id === 'leftElbow')!;
    expect(elbow.stabilized.angleDegrees[3]).toBeCloseTo(90 + 60 * 0.081, 2);
    expect(elbow.unsmoothed.angularVelocityDegreesPerSecond[3]).toBeCloseTo(60, 2);
    expect(elbow.stabilized.angularAccelerationDegreesPerSecondSquared[3]).toBeCloseTo(0, 0);
    expect(elbow.stabilized.angularAccelerationDegreesPerSecondSquared[0]).toBeNull();
    expect(pose.joints.find((j) => j.id === 'leftKnee')!.stabilized.angleDegrees.every((v) => v === null)).toBe(true);
    const json = JSON.parse(serializeData(pose));
    expect(Array.isArray(json.joints[0].stabilized.state)).toBe(true);
  });
  it('retains pre-repair tracking evidence and manual anchors independently of the resulting trajectory', () => {
    const clip = fixture();
    const anchors = [
      { frame: 0, x: 0.1, y: 0.1, width: 0.02, height: 0.02, role: 'start' as const },
      { frame: 6, x: 0.3, y: 0.3, width: 0.02, height: 0.02, role: 'end' as const }
    ];
    const pass = Array.from({ length: 7 }, (_, i) =>
      i === 3 ? null : { x: 0.1 + i / 30, y: 0.1 + i / 30, confidence: 0.9 }
    );
    const series = reconstructTrajectory(clip.index, anchors, pass, pass, 1000, 500);
    expect(series.observations!.states[0]).toBe(MANUAL);
    expect(series.observations!.states[3]).toBe(0);
    expect(series.states[3]).toBe(ESTIMATED);
    clip.motion!.tracks[0].result = series;
    const data = motionAnalysisData(clip).tracks[0].result!;
    expect(data.evidenceBeforeRepair!.xNormalized[3]).toBeNull();
    expect(data.coordinates.xNormalized[3]).not.toBeNull();
  });
  it('supports annotations-only exports and serializes non-finite values as null', () => {
    const clip = fixture();
    clip.motion!.tracks[0].result = undefined;
    expect(motionAnalysisData(clip).tracks[0]).toMatchObject({ status: 'annotations-only', result: null });
    expect(JSON.parse(serializeData({ a: Float32Array.of(0, NaN, Infinity), b: 0 }))).toEqual({
      a: [0, null, null],
      b: 0
    });
  });
});

describe('serve data exports', () => {
  it('exports partial frame-specific annotations, assumptions and calibration errors without inventing results', () => {
    const clip = fixture();
    clip.serve = newServeSetup();
    clip.serve.lines.near = {
      points: [
        { x: 0.1, y: 0.8 },
        { x: 0.9, y: 0.8 }
      ],
      frame: 6,
      pixelFloor: 2
    };
    clip.serve.contact = { frame: 0, x: 0.4, y: 0.3, radius: 2 };
    const data = serveSpeedData({ section: 'serve-speed', clip, issue: { message: 'Review marks' } });
    expect(data.status).toBe('needs-review');
    expect(data.result).toBeNull();
    expect(data.trajectory).toBeNull();
    expect(data.courtMarks[0]).toMatchObject({
      frame: 6,
      sourceTimeSeconds: 0.22,
      pointsPixels: [
        { x: 100, y: 400 },
        { x: 900, y: 400 }
      ]
    });
    expect(data.ballMarks.contact!.frame).toBe(0);
    expect(data.ballMarks.contactMatchesSelectedFrame).toBe(true);
    expect(data.annotations).toMatchObject({ contactDepth: 0.5, depthError: 0.2 });
    expect(data.courtDimensionsMeters).toMatchObject({ singlesWidth: 8.23, length: 23.77 });
    expect(data.courtDimensionsMeters.basis).toContain('assumed');
  });
  it('exports physical 3D trajectory arc length separately from horizontal distance, with correct slowdown time', () => {
    const clip = fixture();
    clip.index = createFrameIndex([0, 0.5, 1, 1.5, 2].map((timestamp) => ({ timestamp, duration: 0.5 })));
    clip.serve = newServeSetup();
    clip.serve.slowdown = 2;
    clip.serve.contact = { frame: 0, x: 0.4, y: 0.3, radius: 2 };
    clip.serve.bounce = { frame: 4, x: 0.4, y: 0.6, radius: 2 };
    const result: SpeedResult = {
      launchKph: 16,
      rangeKph: [14, 18],
      horizontalMeanKph: 14.4,
      flightSeconds: 1,
      distance: 4,
      contact3D: [0, 0, 3],
      bounce3D: [0, 4, 0],
      contactHeightRange: [2.8, 3.2],
      velocity: [4, -2],
      camera: {
        p: [
          [1, 0, 0, 0],
          [0, 1, 0, 0],
          [0, 0, 0, 1]
        ],
        rms: 1,
        checkError: 2,
        residuals: [],
        worstMark: 'near',
        quality: 'good',
        pixelError: 2
      },
      netClearance: 0.3,
      flightRms: 1,
      checkedPoints: 2,
      variants: 136,
      collisionVariants: 0,
      path: [
        { x: 0.4, y: 0.3, z: 3, time: 0, world: [0, 0, 3] },
        { x: 0.4, y: 0.4, z: 2, time: 0.5, world: [0, 2, 2] },
        { x: 0.4, y: 0.6, z: 0, time: 1, world: [0, 4, 0] }
      ]
    };
    const data = serveSpeedData({ section: 'serve-speed', clip, result });
    expect(data.status).toBe('estimated');
    expect(data.trajectory!.arcLengthMeters).toBeCloseTo(Math.sqrt(5) + Math.sqrt(8), 8);
    expect(data.trajectory!.horizontalDistanceMeters).toBe(4);
    expect(data.trajectory!.samples.map((p) => p.sourceTimeSeconds)).toEqual([0, 1, 2]);
    expect(data.trajectory!.launchVelocityMetersPerSecond).toEqual([0, 4, -2]);
    expect(data.derivedPositions.contactMeters).toEqual([0, 0, 3]);
    expect(data.result!.camera).toEqual(result.camera);
  });
});
