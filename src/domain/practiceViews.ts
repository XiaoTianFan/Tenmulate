import { COURT } from './court';

export const OVERHEAD_PRACTICE_OPPONENT = { x: .1, z: 9.8 } as const;
export const QUICK_PRACTICE_VIEWS = {
  overhead: { eyeHeight: 1.7, behindBaseline: COURT.serviceLineFromNet - COURT.halfLength, lateral: 0, yaw: 0, pitch: 18, fov: 70 },
  volley: { eyeHeight: 1.7, behindBaseline: COURT.serviceLineFromNet / 2 - COURT.halfLength, lateral: 0, yaw: 0, pitch: -2, fov: 70 },
} as const;
