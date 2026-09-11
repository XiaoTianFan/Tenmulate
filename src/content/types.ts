import type { SurfaceId } from '../domain/court';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import type { SpinKind } from '../engine/trajectory/physics';
import type { LandingZone, LandingZoneSize } from '../engine/trajectory/landingZone';
import type { ReturnZone } from '../engine/session/returnZone';

export type OpponentHand = 'left' | 'right';
export type StrokeSide = 'forehand' | 'backhand';
export type StrokeChoice = StrokeSide | 'auto';
export type ServeRhythm = 'normal' | 'compact';
export type ContactTiming = 'rise' | 'apex' | 'descent';
export type ShotFamily = 'groundstroke' | 'serve' | 'approach' | 'volley' | 'half-volley' | 'lob' | 'overhead' | 'drop-shot';
export type ReturnShotType = 'groundstroke' | 'drop-shot' | 'volley' | 'overhead' | 'lob';
export type ReturnShotConfiguration = Readonly<{
  contactTiming?: ContactTiming;
  paceKmh?: number;
  type: ReturnShotType;
  spin: 'topspin' | 'flat' | 'slice';
  spinRateRpm?: number;
}>;
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
  /** Legacy camera-relative calibration; retained for importing older drills. */
  returnZone?: ReturnZone;
}>;

export type DrillEventV1 = Readonly<{
  id: string;
  shotId: string;
  paceKmh?: number;
  spin?: 'preset' | SpinKind;
  target?: Readonly<{ x: number; z: number }>;
  landingZone?: LandingZoneSize;
  returnLandingZone?: LandingZone;
  returnShot?: ReturnShotConfiguration;
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

/** Canonical drill authoring. V1 remains the legacy import/Quick Practice contract. */
export type RallyShotFamily = Exclude<ShotFamily, 'serve'>;
export type DrillBall<Side extends StrokeChoice = StrokeSide> = Readonly<{
  /** When this hitter meets the incoming bounce; absent legacy values mean early descent. */
  contactTiming?: ContactTiming;
  family: ShotFamily;
  stroke: Side;
  hand: OpponentHand;
  paceKmh: number;
  spin: SpinKind;
  spinRateRpm: number;
  variationPercent: number;
  bounceFactor: number;
  trajectoryMode: 'natural' | 'exact';
  netClearanceM: number;
  serveRhythm: ServeRhythm;
}>;
export type OpponentBall = DrillBall<StrokeChoice>;
export type OpponentResponse = Readonly<{ ball: OpponentBall; landingZone: LandingZone }>;
export type OpeningFeed = OpponentResponse & Readonly<{ position: Readonly<{ x: number; z: number }> }>;
export type CameraMoveMoment = 'auto' | 'player-hit' | 'opponent-hit' | 'after-split';
export type CameraFocusTarget = Readonly<{
  mode: 'auto' | 'ball' | 'opponent' | 'next-shot' | 'direction' | 'point';
  direction?: Readonly<{ yaw: number; pitch: number }>;
  point?: Readonly<{ x: number; y: number; z: number }>;
}>;
/** Outgoing transition; absent fields retain the automatic tennis camera. */
export type DrillCameraTransition = Readonly<{
  movement?: Readonly<{
    destination: 'auto' | 'neutral' | 'next-shot' | 'waypoint';
    start?: CameraMoveMoment;
    delaySeconds?: number;
    resume?: CameraMoveMoment;
    resumeDelaySeconds?: number;
    pacePercent?: number;
    waypoint?: Pick<CameraConfiguration, 'lateral' | 'behindBaseline' | 'eyeHeight'>;
  }>;
  focus?: Readonly<{ beforeReturn?: CameraFocusTarget; afterReturn?: CameraFocusTarget }>;
}>;
export type PlayerShotEventV2 = Readonly<{
  id: string;
  presetId?: string;
  label: string;
  cue: string;
  camera: CameraConfiguration;
  cameraTransition?: DrillCameraTransition;
  ball: DrillBall;
  landingZone: LandingZone;
  opponentReturn: OpponentResponse;
  intervalSeconds?: number;
  rhythmPercent?: number;
  movementPercent?: number;
  /** Explicit fresh point, primarily for sequences of serve-return practice. */
  openingFeed?: OpeningFeed;
}>;
export type DrillDefinitionV2 = Readonly<{
  schemaVersion: 2;
  /** Handedness of the stored court layout. Missing in older right-handed layouts. */
  playerHand?: OpponentHand;
  id: string;
  title: string;
  description: string;
  category: SessionCategory;
  launch: OpeningFeed;
  events: readonly PlayerShotEventV2[];
  defaultInterval: number;
  defaultRhythmPercent?: number;
  defaultMovementPercent?: number;
  defaultRepetitions: number;
}>;
export type SavedShotV2 = Readonly<{ schemaVersion: 2; playerHand?: OpponentHand; id: string; name: string; event: PlayerShotEventV2 }>;
export type DrillDefinition = DrillDefinitionV1 | DrillDefinitionV2;
