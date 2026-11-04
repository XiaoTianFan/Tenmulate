import { useMemo } from 'react';
import type { FrameIndex } from '../timeline';
import type { ServeSetup, SpeedResult } from './types';

export function SpeedOverlay({
  setup,
  result,
  frame,
  index,
  width,
  height,
  selecting
}: {
  setup: ServeSetup;
  result?: SpeedResult;
  frame: number;
  index?: FrameIndex;
  width: number;
  height: number;
  selecting: boolean;
}) {
  const path = result?.path;
  const pathPoints = useMemo(
    () => path?.map((p) => `${(p.x * width).toFixed(2)},${(p.y * height).toFixed(2)}`).join(' '),
    [path, width, height]
  );
  if (!setup.showOverlay && !selecting) return null;
  const time =
    index && setup.contact ? (index.timestamps[frame] - index.timestamps[setup.contact.frame]) / setup.slowdown : -1;
  const cursorIndex =
    path && time >= 0 && time <= result.flightSeconds
      ? Math.min(path.length - 2, Math.floor((time / result.flightSeconds) * (path.length - 1)))
      : -1;
  const a = cursorIndex >= 0 ? path![cursorIndex] : undefined,
    b = cursorIndex >= 0 ? path![cursorIndex + 1] : undefined;
  const fraction = a && b ? (time - a.time) / (b.time - a.time) : 0;
  return (
    <svg className="speed-overlay" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {Object.entries(setup.lines).map(([key, line]) =>
        line ? (
          <line
            key={key}
            x1={line.points[0].x * width}
            y1={line.points[0].y * height}
            x2={line.points[1].x * width}
            y2={line.points[1].y * height}
            className="speed-court-line"
          />
        ) : null
      )}
      {path ? <polyline points={pathPoints} className="speed-flight-line" /> : null}
      {[setup.contact, setup.bounce, ...setup.flight].map((mark, i) =>
        mark ? (
          <circle
            key={i}
            cx={mark.x * width}
            cy={mark.y * height}
            r={width / 180}
            className={`speed-ball-mark${mark.frame === frame ? ' is-current' : ''}`}
          />
        ) : null
      )}
      {a && b ? (
        <circle
          cx={(a.x + (b.x - a.x) * fraction) * width}
          cy={(a.y + (b.y - a.y) * fraction) * height}
          r={width / 140}
          className="speed-model-ball"
        />
      ) : null}
    </svg>
  );
}
