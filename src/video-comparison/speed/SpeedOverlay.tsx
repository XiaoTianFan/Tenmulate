import { useMemo } from 'react';
import { correctLens, distortLens } from './lens';
import type { FrameIndex } from '../timeline';
import type { ServeSetup, SpeedResult } from './types';

export function SpeedOverlay({
  setup,
  result,
  frame,
  index,
  width,
  height
}: {
  setup: ServeSetup;
  result?: SpeedResult;
  frame: number;
  index?: FrameIndex;
  width: number;
  height: number;
}) {
  const path = result?.path;
  const pathPoints = useMemo(
    () => path?.map((p) => `${(p.x * width).toFixed(2)},${(p.y * height).toFixed(2)}`).join(' '),
    [path, width, height]
  );
  const court = useMemo(
    () =>
      Object.entries(setup.lines).flatMap(([key, line]) => {
        if (!line) return [];
        const lens = setup.lens ?? 0;
        const [a, b] = line.points.map((p) => correctLens(p, lens, width, height));
        const points = Array.from({ length: lens ? 25 : 2 }, (_, i) => {
          const fraction = i / (lens ? 24 : 1);
          const p = distortLens(
            { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction },
            lens,
            width,
            height
          );
          return `${p.x * width},${p.y * height}`;
        }).join(' ');
        return [{ key, points }];
      }),
    [setup.lines, setup.lens, width, height]
  );
  if (!setup.showCourtOverlay && !setup.showBallOverlay) return null;
  const time =
    index && setup.contact
      ? (index.timestamps[frame] - index.timestamps[setup.contact.frame]) / setup.slowdown
      : -1;
  const cursorIndex =
    path && time >= 0 && time <= result.flightSeconds
      ? Math.min(path.length - 2, Math.floor((time / result.flightSeconds) * (path.length - 1)))
      : -1;
  const a = cursorIndex >= 0 ? path![cursorIndex] : undefined,
    b = cursorIndex >= 0 ? path![cursorIndex + 1] : undefined;
  const fraction = a && b ? (time - a.time) / (b.time - a.time) : 0;
  return (
    <svg className="speed-overlay" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {setup.showCourtOverlay
        ? court.map((line) => <polyline key={line.key} points={line.points} className="speed-court-line" />)
        : null}
      {setup.showBallOverlay && path ? <polyline points={pathPoints} className="speed-flight-line" /> : null}
      {setup.showBallOverlay
        ? [setup.contact, setup.bounce, ...setup.flight].map((mark, i) =>
            mark ? (
              <circle
                key={i}
                cx={mark.x * width}
                cy={mark.y * height}
                r={width / 180}
                className={`speed-ball-mark${mark.frame === frame ? ' is-current' : ''}`}
              />
            ) : null
          )
        : null}
      {setup.showBallOverlay && a && b ? (
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
