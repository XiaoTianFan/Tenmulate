import type { SurfaceId } from '../domain/court';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import type { SpinKind } from '../engine/trajectory/physics';
import type { LandingZoneSize } from '../engine/trajectory/landingZone';
import type { ReturnZone } from '../engine/session/returnZone';

export type OpponentHand = 'left' | 'right';
export type ServeRhythm = 'normal' | 'compact';
export type ShotFamily = 'groundstroke' | 'serve' | 'approach' | 'volley' | 'half-volley' | 'lob' | 'overhead';
export type SessionCategory =
  | 'Quick Rally'
  | 'Return Practice'
  | 'Tactical Pattern'
  | 'Serve & Volley'
  | 'Net & Overhead'
  | 'Custom';

export type CameraMotionDefinition = Readonly<{
  from?: Partial<CameraConfiguration>;
  to: Partial<CameraConfiguration>;
  duration: number;
  delay?: number;
}>;

export type ShotDefinitionV1 = Readonly<{
  schemaVersion: 1;
  id: string;
  label: string;
  cue: string;
  family: ShotFamily;
  source: Readonly<{ x: number; y: number; z: number }>;
  target: Readonly<{ x: number; z: number }>;
  paceKmh: number;
  spin: SpinKind;
  surface: SurfaceId;
  opponentHand: OpponentHand;
  serveRhythm?: ServeRhythm;
  backhandStyle?: 'one-handed' | 'two-handed';
  stroke?: 'forehand' | 'backhand';
  netClearanceM?: number;
  receiverZ?: number;
  direction: 'Near left' | 'Body' | 'Near right';
  depth: 'Short' | 'Mid' | 'Deep' | 'Service box';
  cameraMotion?: CameraMotionDefinition;
}>;

export type DrillDefinitionV1 = Readonly<{
  schemaVersion: 1;
  id: string;
  title: string;
  description: string;
  category: SessionCategory;
  shotIds: readonly string[];
  events?: readonly DrillEventV1[];
  defaultInterval: number;
  /** Preferred uniform stroke rhythm; the interval solver may raise it to fit. */
  defaultRhythmPercent?: number;
  defaultMovementPercent?: number;
  defaultRepetitions: number;
  returnZone?: ReturnZone;
}>;

export type DrillEventV1 = Readonly<{
  id: string;
  shotId: string;
  paceKmh?: number;
  spin?: 'preset' | SpinKind;
  target?: Readonly<{ x: number; z: number }>;
  landingZone?: LandingZoneSize;
  variationPercent?: number;
  opponentPosition?: Readonly<{ x: number; z: number }>;
  cameraMotion?: CameraMotionDefinition | null;
  cue?: string;
  serveRhythm?: 'preset' | ServeRhythm;
  netClearanceM?: number;
  label?: string;
  camera?: CameraConfiguration;
  stroke?: 'forehand' | 'backhand';
  opponentHand?: OpponentHand;
  spinRateRpm?: number;
  bounceFactor?: number;
  trajectoryMode?: 'natural' | 'exact';
  rhythmPercent?: number;
  movementPercent?: number;
  intervalSeconds?: number;
}>;

export type SavedShotV1 = Readonly<{id:string;name:string;event:DrillEventV1}>;
