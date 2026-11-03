import type { FrameIndex } from '../timeline';
import { BONES, ESTIMATED, JOINTS, sampleAt, type ClipMotion, type MotionVisibility } from './types';
import { jointAngle } from './series';
type Rect = { x: number; y: number; width: number; height: number };
/** Shared source-coordinate renderer for native review, decoded playback and export. */
export function drawMotion(context: CanvasRenderingContext2D, motion: ClipMotion | undefined, index: FrameIndex, frame: number, rect: Rect, visibility?: MotionVisibility, mirrored = false) {
  if (!motion || frame < 0) return;
  const view = visibility ?? motion.view, size = Math.max(2, Math.min(7, Math.min(rect.width, rect.height) / 120));
  const xy = (p: { x: number; y: number }) => [rect.x + p.x * rect.width, rect.y + p.y * rect.height] as const;
  const dot = (p: { x: number; y: number; state: number }) => {
    const [x, y] = xy(p); context.beginPath(); context.arc(x, y, size, 0, Math.PI * 2);
    if (p.state === ESTIMATED) context.stroke(); else context.fill();
  };
  const label = (text: string, p: { x: number; y: number }) => {
    const [x, y] = xy(p); context.save(); context.translate(x + size * 2, y - size * 2); if (mirrored) context.scale(-1, 1);
    context.font = `${Math.max(10, Math.min(24, size * 3))}px sans-serif`; context.lineWidth = 3;
    context.strokeStyle = '#000'; context.strokeText(text, 0, 0); context.fillText(text, 0, 0); context.restore();
  };
  context.save(); context.lineWidth = Math.max(1.5, size / 2); context.lineJoin = 'round';
  if (view.tracks) for (const track of motion.tracks) {
    if (!track.visible) continue;
    const series = track.result; if (!series) continue;
    context.strokeStyle = context.fillStyle = track.color;
    const end = motion.trail === 0 ? series.end : Math.min(frame, series.end), after = motion.trail === 0 ? -Infinity : index.timestamps[frame] - motion.trail;
    let previous: ReturnType<typeof sampleAt> = null, estimated = false; context.beginPath();
    // Retain uncertainty transitions while bounding the live canvas geometry.
    const stride = Math.max(1, Math.ceil((end - series.start + 1) / 600));
    const flush = () => { context.globalAlpha = estimated ? .45 : 1; context.stroke(); context.beginPath(); };
    for (let f = series.start; f <= end; f++) {
      const point = sampleAt(series, f);
      if (!point || index.timestamps[f] < after) { if (previous) flush(); previous = null; continue; }
      const inferred = point.state === ESTIMATED || previous?.state === ESTIMATED;
      if (previous && inferred === estimated && f % stride !== 0 && f !== end) continue;
      if (previous && inferred !== estimated) { flush(); context.moveTo(...xy(previous)); }
      estimated = inferred;
      if (previous) context.lineTo(...xy(point)); else context.moveTo(...xy(point)); previous = point;
    }
    flush(); context.globalAlpha = 1;
    const point = sampleAt(series, frame);
    if (point) { dot(point); label(`${point.state === ESTIMATED ? '≈ ' : ''}${track.name}`, point); }

  }
  const pose = motion.pose.result;
  if (pose && view.skeleton) {
    context.strokeStyle = context.fillStyle = '#47d9ff';
    for (const [a, b] of BONES) {
      const left = sampleAt(pose, frame, a), right = sampleAt(pose, frame, b); if (!left || !right) continue;
      context.setLineDash(left.state === ESTIMATED || right.state === ESTIMATED ? [size * 2, size] : []);
      context.beginPath(); context.moveTo(...xy(left)); context.lineTo(...xy(right)); context.stroke();
    }
    context.setLineDash([]); for (let p = 0; p < 17; p++) { const point = sampleAt(pose, frame, p); if (point) dot(point); }
  }
  if (pose && view.angles) for (const id of motion.joints) {
    const joint = JOINTS[id], value = jointAngle(pose, frame, id), point = joint && sampleAt(pose, frame, joint.points[1]);
    if (value === null || !point) continue;
    const estimated = joint.points.some(p => sampleAt(pose, frame, p)?.state === ESTIMATED);
    context.fillStyle = '#f6e62d'; label(`${estimated ? '≈' : ''}${value.toFixed(0)}°`, point);
  }
  context.restore();
}
