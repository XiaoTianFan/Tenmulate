import type { SurfaceId } from '../domain/court';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import type { SpinKind } from '../engine/trajectory/physics';

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
  /** Legacy seconds remain readable; new authored drills use this percentage. */
  defaultRhythmPercent?: number;
  defaultRepetitions: number;
}>;

export type DrillEventV1 = Readonly<{
  id: string;
  shotId: string;
  paceKmh?: number;
  spin?: 'preset' | SpinKind;
  target?: Readonly<{ x: number; z: number }>;
  opponentPosition?: Readonly<{ x: number; z: number }>;
  cameraMotion?: CameraMotionDefinition | null;
  cue?: string;
  serveRhythm?: 'preset' | ServeRhythm;
  netClearanceM?: number;
}>;
