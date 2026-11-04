import type { FrameIndex } from '../timeline';
export type Point = { x: number; y: number };
export type Line = [Point, Point];
export type GroundLine = 'near' | 'nearService' | 'service' | 'far';
export type CourtLine = GroundLine | 'netA' | 'netB' | 'netCenter';
export const COURT_LINES: Record<CourtLine, string> = {
  near: 'Near singles baseline',
  nearService: 'Near service line',
  far: 'Far singles baseline',
  service: 'Far service line',
  netA: 'Net support A · top to ground',
  netB: 'Net support B · top to ground',
  netCenter: 'Net centre · top to ground'
};
export const COURT_KEYS = Object.keys(COURT_LINES) as CourtLine[];
export const GROUND_KEYS: GroundLine[] = ['near', 'nearService', 'service', 'far'];
export const supportsHalf = (kind: string) => kind === 'near' || kind === 'nearService';
export const isNetLine = (kind: string) => kind === 'netA' || kind === 'netB' || kind === 'netCenter';
export type CourtMark = { points: Line; frame: number; pixelFloor: number; span?: 'full' | 'half' };
export type CourtMapping = {
  halves: Partial<Record<GroundLine, 'left' | 'right'>>;
  supports: Partial<Record<'netA' | 'netB', 'left' | 'right'>>;
};
export type BallMark = Point & { frame: number; radius: number };
export type ServeSetup = {
  lines: Partial<Record<CourtLine, CourtMark>>;
  netSupports: 'doubles' | 'singles';
  contact?: BallMark;
  bounce?: BallMark;
  flight: BallMark[];
  servingEnd: 'near' | 'far';
  contactDepth: number;
  depthError: number;
  pixelError: number;
  frameError: number;
  slowdown: number;
  drag: number;
  dragError: number;
  liftError: number;
  showCourtOverlay: boolean;
  showBallOverlay: boolean;
};
export const newServeSetup = (): ServeSetup => ({
  lines: {},
  netSupports: 'doubles',
  flight: [],
  servingEnd: 'near',
  contactDepth: 0.5,
  depthError: 0.2,
  pixelError: 2,
  frameError: 0.5,
  slowdown: 1,
  drag: 0.02,
  dragError: 0.005,
  liftError: 0.006,
  showCourtOverlay: true,
  showBallOverlay: true
});
export type SpeedSelection = { kind: CourtLine | 'contact' | 'bounce' | 'flight'; frame: number };
export type SpeedInput = {
  setup: ServeSetup;
  width: number;
  height: number;
  index: FrameIndex;
  contact: number | null;
  start: number;
  end: number;
};
export type Camera = {
  p: number[][];
  rms: number;
  checkError: number;
  residuals: { mark: CourtLine; pixels: number }[];
  worstMark: CourtLine;
  quality: 'good' | 'review';
  pixelError: number;
  mapping?: CourtMapping;
  coverage?: { groundLines: number; netLines: number; halfLines: number };
  controls?: { mark: CourtLine; endpoint: number; world: number[] }[];
};
export type MeasurementIssue = { message: string; mark?: CourtLine; pixels?: number };
export type CalibrationInput = Pick<SpeedInput, 'setup' | 'width' | 'height'>;
export type SpeedRequest = { kind: 'calibrate'; input: CalibrationInput } | { kind: 'estimate'; input: SpeedInput };
export type SpeedResult = {
  launchKph: number;
  rangeKph: [number, number];
  horizontalMeanKph: number;
  flightSeconds: number;
  distance: number;
  contact3D: number[];
  contactHeightRange: [number, number];
  bounce3D: number[];
  velocity: number[];
  camera: Camera;
  netClearance: number;
  flightRms: number | null;
  checkedPoints: number;
  variants: number;
  collisionVariants: number;
  path: { x: number; y: number; time: number; z: number; world: [number, number, number] }[];
};
