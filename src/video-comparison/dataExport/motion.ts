import { plotData } from '../analysis/series';
import { jointSignal, POSE_SMOOTHING } from '../analysis/poseAngles';
import {
  BONES,
  ESTIMATED,
  JOINTS,
  LANDMARKS,
  METRICS,
  sampleAt,
  type ClipMotion,
  type Metric,
  type MotionSeries,
  type SampleBuffer
} from '../analysis/types';
import { exportMetadata, finite, frameColumns, frameReference } from './common';
import type { DataClip } from './types';
const pointMetrics: Metric[] = ['x', 'y', 'vx', 'vy', 'speed', 'ax', 'ay', 'acceleration', 'confidence'];
const definitions = Object.fromEntries(
  Object.entries(METRICS).map(([key, value]) => [key, { name: value.name, unit: value.unit || 'dimensionless' }])
);
function sampleColumns(series: MotionSeries, buffer: SampleBuffer, point: number) {
  const columns = {
    xNormalized: [] as (number | null)[],
    yNormalized: [] as (number | null)[],
    confidence: [] as (number | null)[],
    state: [] as number[]
  };
  for (let f = series.start; f <= series.end; f++) {
    const i = (f - series.start) * series.points + point,
      state = buffer.states[i];
    columns.xNormalized.push(state ? finite(buffer.values[i * 3]) : null);
    columns.yNormalized.push(state ? finite(buffer.values[i * 3 + 1]) : null);
    columns.confidence.push(state ? finite(buffer.values[i * 3 + 2]) : null);
    columns.state.push(state);
  }
  return columns;
}
function metrics(clip: DataClip, motion: ClipMotion, target: string) {
  return {
    smoothingSeconds: POSE_SMOOTHING,
    values: Object.fromEntries(
      pointMetrics.map((metric) => {
        const data = plotData(motion, { id: '', target, metric, smoothing: POSE_SMOOTHING }, clip.index);
        return [metric, { values: data.values.map(finite), estimated: data.estimated }];
      })
    )
  };
}
function trajectoryLength(series: MotionSeries) {
  let total = 0,
    estimatedSegments = 0,
    missingSegments = 0;
  const cumulativePixels: (number | null)[] = [];
  for (let f = series.start; f <= series.end; f++) {
    const p = sampleAt(series, f),
      prior = f > series.start ? sampleAt(series, f - 1) : null;
    if (p && prior) {
      total += Math.hypot((p.x - prior.x) * series.width, (p.y - prior.y) * series.height);
      if (p.state === ESTIMATED || prior.state === ESTIMATED) estimatedSegments++;
    } else if (f > series.start) missingSegments++;
    cumulativePixels.push(p ? total : null);
  }
  return {
    totalPixels: total,
    cumulativePixels,
    estimatedSegments,
    missingSegments,
    method:
      'Sum of adjacent valid sample distances in source pixels. Gaps are not bridged; estimated segments are included and counted.'
  };
}
function seriesMetadata(clip: DataClip, series: MotionSeries) {
  return {
    model: series.model,
    startFrame: series.start,
    endFrame: series.end,
    sourceWidthPixels: series.width,
    sourceHeightPixels: series.height,
    ...frameColumns(clip, series.start, series.end)
  };
}
export function motionAnalysisData(clip: DataClip) {
  const motion = clip.motion;
  return {
    ...exportMetadata(clip, 'motion-analysis'),
    metricDefinitions: definitions,
    derivation: {
      defaultSmoothingSeconds: POSE_SMOOTHING,
      position: 'Continuous tracks retain the reconstructed positions. Other positions use local quadratic fitting.',
      derivatives:
        'Same source-time numerical methods as the plots. Missing intervals and detected impacts are respected; undefined derivatives are null.',
      pose: 'All 17 landmarks and all 8 joint definitions are included regardless of overlay visibility. Angles are 2D projections, in degrees.',
      rawPose:
        'Direct detections include low-confidence model outputs at sampled frames. Pre-stabilization observations also contain explicitly estimated draft interpolation. Older results without retained direct detections report null.'
    },
    view: motion ? { overlays: motion.view, trailSeconds: motion.trail, enabledJoints: motion.joints } : null,
    tracks: (motion?.tracks ?? []).map((track) => ({
      id: track.id,
      name: track.name,
      color: track.color,
      visible: track.visible,
      revision: track.revision,
      anchors: track.anchors.map((anchor) => ({ ...anchor, ...frameReference(clip, anchor.frame) })),
      status: !track.result ? 'annotations-only' : track.result.model === 'manual' ? 'manual-anchors-only' : 'analyzed',
      result: track.result
        ? {
            ...seriesMetadata(clip, track.result),
            continuous: track.result.continuous ?? false,
            detectedCornerFrames: track.result.corners ?? [],
            rejectedExcursions: track.result.rejected ?? 0,
            coordinates: sampleColumns(track.result, track.result, 0),
            evidenceBeforeRepair: track.result.observations
              ? sampleColumns(track.result, track.result.observations, 0)
              : null,
            metrics: metrics(clip, motion!, `track:${track.id}`),
            trajectoryLength: trajectoryLength(track.result)
          }
        : null
    })),
    pose: motion?.pose.result
      ? poseData(clip, motion)
      : { quality: motion?.pose.quality ?? null, status: 'not-analyzed', result: null }
  };
}
function poseData(clip: DataClip, motion: ClipMotion) {
  const series = motion.pose.result!;
  return {
    quality: motion.pose.quality,
    status: 'analyzed',
    result: {
      ...seriesMetadata(clip, series),
      sampledDetectionFrames: series.detections?.frames ?? null,
      landmarks: LANDMARKS.map((name, point) => ({
        index: point,
        name,
        coordinates: sampleColumns(series, series, point),
        detections: series.detections ? sampleColumns(series, series.detections, point) : null,
        observationsBeforeStabilization: series.observations ? sampleColumns(series, series.observations, point) : null,
        metrics: metrics(clip, motion, `pose:${point}`)
      })),
      bones: BONES.map(([from, to]) => ({ from, to })),
      joints: Object.entries(JOINTS).map(([id, joint]) => {
        const curves = (smoothing: number) => {
          const signal = jointSignal(series, clip.index, id, smoothing);
          return {
            smoothingSeconds: smoothing,
            angleDegrees: Array.from(signal.values, finite),
            angularVelocityDegreesPerSecond: Array.from(signal.velocity, finite),
            angularAccelerationDegreesPerSecondSquared: Array.from(signal.acceleration, finite),
            state: Array.from(signal.states),
            derivativeState: Array.from(signal.derivativeStates)
          };
        };
        return {
          id,
          name: joint.name,
          landmarkIndices: joint.points,
          vertexLandmarkIndex: joint.points[1],
          stabilized: curves(POSE_SMOOTHING),
          unsmoothed: curves(0)
        };
      })
    }
  };
}
export function motionPlotsData(clip: DataClip) {
  return {
    ...exportMetadata(clip, 'motion-plots'),
    metricDefinitions: definitions,
    scope:
      'All configured plots at every available source frame, regardless of current chart zoom, visibility or screen resolution. Values match the chosen plot smoothing.',
    plots: (clip.motion?.plots ?? []).map((plot) => {
      const data = plotData(clip.motion!, plot, clip.index),
        [kind, id] = plot.target.split(':');
      const target =
        kind === 'track'
          ? { kind, id, name: clip.motion!.tracks.find((t) => t.id === id)?.name ?? null }
          : kind === 'pose'
            ? { kind, index: Number(id), name: LANDMARKS[Number(id)] }
            : { kind, id, name: JOINTS[id]?.name };
      return {
        ...plot,
        target,
        status: data.values.length ? 'available' : 'no-result',
        unit: METRICS[plot.metric].unit || 'dimensionless',
        ...frameColumns(clip, data.start, data.start + data.values.length - 1),
        values: data.values.map(finite),
        estimated: data.estimated
      };
    })
  };
}
