import type { FrameIndex } from '../timeline';
export type Point = { x: number; y: number };
export type Line = [Point, Point];
export type CourtLine = 'near' | 'far' | 'service' | 'net';
export const COURT_LINES: Record<CourtLine, string> = {
  near: 'Near singles baseline',
  far: 'Far singles baseline',
  service: 'Far service line',
  net: 'Net support tops'
};
export type BallMark = Point & { frame: number; radius: number };
export type ServeSetup = {
  courtFrame?: number;
  lines: Partial<Record<CourtLine, Line>>;
  netCenter?: Point;
  netSupports: 'doubles' | 'singles';
  stationary: boolean;
  contact?: BallMark;
  bounce?: BallMark;
  flight: BallMark[];
  height: number;
  heightError: number;
  pixelError: number;
  frameError: number;
  slowdown: number;
  drag: number;
  dragError: number;
  liftError: number;
  showOverlay: boolean;
};
export const newServeSetup = (): ServeSetup => ({
  lines: {},
  netSupports: 'doubles',
  stationary: false,
  flight: [],
  height: 2.6,
  heightError: 0.25,
  pixelError: 2,
  frameError: 0.5,
  slowdown: 1,
  drag: 0.02,
  dragError: 0.005,
  liftError: 0.006,
  showOverlay: true
});
export type SpeedSelection = { kind: CourtLine | 'netCenter' | 'contact' | 'bounce' | 'flight'; frame: number };
export type SpeedInput = {
  setup: ServeSetup;
  width: number;
  height: number;
  index: FrameIndex;
  contact: number | null;
  start: number;
  end: number;
};
export type Camera = { p: number[][]; rms: number; checkError: number };
export type SpeedResult = {
  launchKph: number;
  rangeKph: [number, number];
  horizontalMeanKph: number;
  flightSeconds: number;
  distance: number;
  contact3D: number[];
  bounce3D: number[];
  velocity: number[];
  camera: Camera;
  netClearance: number;
  flightRms: number | null;
  checkedPoints: number;
  variants: number;
  collisionVariants: number;
  path: { x: number; y: number; time: number; z: number }[];
};
