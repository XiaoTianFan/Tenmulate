import type { CompiledSession } from '../engine/session/compileSession';
import type { CameraConfiguration, QualityMode } from '../engine/rendering/TennisScene';
import type { EnvironmentConfiguration } from '../domain/environment';
import type { SurfaceId } from '../domain/court';

export type PracticeMode = 'rehearsal' | 'learning';
export type SessionLaunch = Readonly<{
  session: CompiledSession;
  mode: PracticeMode;
  camera: CameraConfiguration;
  environment: EnvironmentConfiguration;
  visualSurface: SurfaceId;
  quality: QualityMode;
}>;
