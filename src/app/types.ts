import type { CompiledSession } from '../engine/session/compileSession';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';

export type PracticeMode = 'rehearsal' | 'learning';

export type SessionLaunch = Readonly<{
  session: CompiledSession;
  mode: PracticeMode;
  camera: CameraConfiguration;
}>;
