import { useEffect, useMemo, useRef, useState } from 'react';
import { COURT } from '../domain/court';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';

/** Temporary viewing pose; never writes an authored player camera. */
export function useCourtOverview(camera: CameraConfiguration, enabled: boolean) {
  const container = useRef<HTMLDivElement>(null), [aspect, setAspect] = useState(1.6);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setAspect(entry.contentRect.width / Math.max(1, entry.contentRect.height)); });
    observer.observe(container.current); return () => observer.disconnect();
  }, []);
  const displayCamera = useMemo(() => enabled ? { eyeHeight: Math.max(11, (COURT.halfLength + 5) * aspect),
    behindBaseline: -COURT.halfLength, lateral: 0, pitch: -90, yaw: 0, fov: 90 } : camera, [camera, enabled, aspect]);
  return { container, displayCamera };
}
