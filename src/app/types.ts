import type { CompiledSession } from '../engine/session/compileSession';
import type { CameraConfiguration, QualityMode } from '../engine/rendering/TennisScene';
import type { EnvironmentConfiguration } from '../domain/environment';
import type { SurfaceId } from '../domain/court';

export type SessionLaunch = Readonly<{
  session: CompiledSession;
  trajectoryEnabled: boolean;
  camera: CameraConfiguration;
  environment: EnvironmentConfiguration;
  visualSurface: SurfaceId;
  quality: QualityMode;
}>;
