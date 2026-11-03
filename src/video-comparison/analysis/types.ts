import type { CropRect } from '../crop';

/** All coordinates are normalized in the oriented, unmirrored source image. */
export type Anchor = { frame: number; x: number; y: number; width: number; height: number };
export const OBSERVED = 1, MANUAL = 2, ESTIMATED = 3;
export type MotionSeries = {
  start: number; end: number; width: number; height: number; points: number;
  /** Packed x, y, confidence. State 0 means missing, never a measurement at zero. */
  values: Float32Array; states: Uint8Array; model: string;
};
export type MotionTrack = { id: string; name: string; color: string; anchors: Anchor[]; revision: number; visible: boolean; result?: MotionSeries };
export type PoseAnalysis = { region?: CropRect; quality: 'draft' | 'full'; result?: MotionSeries };
export type MotionVisibility = { tracks: boolean; skeleton: boolean; angles: boolean; plots: boolean };
export type Metric = 'x' | 'y' | 'vx' | 'vy' | 'speed' | 'ax' | 'ay' | 'acceleration' | 'confidence' | 'angle' | 'angularVelocity' | 'angularAcceleration';
export type MotionPlot = { id: string; target: string; metric: Metric; smoothing: number };
export type ClipMotion = {
  tracks: MotionTrack[]; pose: PoseAnalysis; view: MotionVisibility;
  trail: number; joints: string[]; plots: MotionPlot[];
};
export const COLORS = ['#f6e62d', '#46d9ff', '#f78ac8', '#8be090', '#ffb565', '#c4a1ff'];
export const JOINTS: Record<string, { name: string; points: [number, number, number] }> = {
  leftElbow: { name: 'Left elbow', points: [5, 7, 9] }, rightElbow: { name: 'Right elbow', points: [6, 8, 10] },
  leftKnee: { name: 'Left knee', points: [11, 13, 15] }, rightKnee: { name: 'Right knee', points: [12, 14, 16] },
  leftShoulder: { name: 'Left shoulder', points: [7, 5, 11] }, rightShoulder: { name: 'Right shoulder', points: [8, 6, 12] },
  leftHip: { name: 'Left hip', points: [5, 11, 13] }, rightHip: { name: 'Right hip', points: [6, 12, 14] },
};
export const LANDMARKS = ['Nose', 'Left eye', 'Right eye', 'Left ear', 'Right ear', 'Left shoulder', 'Right shoulder', 'Left elbow', 'Right elbow', 'Left wrist', 'Right wrist', 'Left hip', 'Right hip', 'Left knee', 'Right knee', 'Left ankle', 'Right ankle'];
export const BONES = [[5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16]];
export const METRICS: Record<Metric, { name: string; unit: string }> = {
  x: { name: 'Horizontal position', unit: 'px' }, y: { name: 'Vertical position', unit: 'px' },
  vx: { name: 'Horizontal velocity', unit: 'px/s' }, vy: { name: 'Vertical velocity', unit: 'px/s' }, speed: { name: 'Speed', unit: 'px/s' },
  ax: { name: 'Horizontal acceleration', unit: 'px/s²' }, ay: { name: 'Vertical acceleration', unit: 'px/s²' }, acceleration: { name: 'Acceleration', unit: 'px/s²' },
  confidence: { name: 'Confidence', unit: '' }, angle: { name: 'Joint angle', unit: '°' }, angularVelocity: { name: 'Angular velocity', unit: '°/s' }, angularAcceleration: { name: 'Angular acceleration', unit: '°/s²' },
};
export const newMotion = (): ClipMotion => ({ tracks: [], pose: { quality: 'draft' }, view: { tracks: true, skeleton: true, angles: true, plots: false }, trail: 0.5, joints: ['leftElbow', 'rightElbow'], plots: [] });
export function emptySeries(start: number, end: number, points: number, width: number, height: number, model: string): MotionSeries {
  const count = (end - start + 1) * points;
  if (!Number.isInteger(count) || count < 1 || end - start + 1 > 7200) throw new Error('Choose an excerpt of up to 60 seconds and 7200 frames for analysis.');
  return { start, end, points, width, height, model, values: new Float32Array(count * 3), states: new Uint8Array(count) };
}
export function putSample(series: MotionSeries, frame: number, point: number, x: number, y: number, confidence: number, state = OBSERVED) {
  if (frame < series.start || frame > series.end || point < 0 || point >= series.points || ![x, y, confidence].every(Number.isFinite)) return;
  const i = (frame - series.start) * series.points + point;
  series.values.set([x, y, confidence], i * 3); series.states[i] = state;
}
export function sampleAt(series: MotionSeries | undefined, frame: number, point = 0) {
  if (!series || frame < series.start || frame > series.end || point >= series.points || point < 0) return null;
  const i = (frame - series.start) * series.points + point, state = series.states[i];
  return state && series.values[i * 3 + 2] >= 0.25 ? { x: series.values[i * 3], y: series.values[i * 3 + 1], confidence: series.values[i * 3 + 2], state } : null;
}
