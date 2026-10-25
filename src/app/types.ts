import type { CompiledSession } from '../engine/session/compileSession';
import type { CameraConfiguration, QualityMode } from '../engine/rendering/TennisScene';
import type { EnvironmentConfiguration } from '../domain/environment';
import type { SurfaceId } from '../domain/court';

export type SessionLaunch = Readonly<{
  session: CompiledSession;
  preparation?: import('../engine/session/sessionCompiler').SessionPreparation;
  trajectoryEnabled: boolean;
  camera: CameraConfiguration;
  environment: EnvironmentConfiguration;
  surface: SurfaceId;
  quality: QualityMode;
  /** Only bundled/project text may follow the interface language during playback. */
  defaultContent?: boolean;
}>;
