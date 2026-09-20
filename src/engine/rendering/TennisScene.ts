import type { PreviewAudioFrame } from '../audio/previewCues';
import * as THREE from 'three';
import { capturePixelRatio } from '../capture/CourtCapture';
import { cameraRotationRadians } from '../../domain/camera';
import { COURT, type SurfaceId } from '../../domain/court';
import { DEFAULT_ENVIRONMENT, SCENE_DEFINITIONS, isOutdoorVenue, windVelocityFromEnvironment, type EnvironmentConfiguration } from '../../domain/environment';
import type { FlightSample, ResolvedTrajectory } from '../trajectory/physics';
import { aimDirectionToCourtPoint, sampleTrajectoryAt } from '../trajectory/physics';
import { createCourt } from './buildCourt';
import { OpponentRig, OpponentRigDisposedError } from './OpponentRig';
import { DynamicSkySystem } from './DynamicSkySystem';
import { WeatherSystem } from './WeatherSystem';
import { updateSceneMaterialEnvironment, type SceneMaterialBundle } from './sceneMaterials';
import { BALL_PRESENTATION } from './presentationMaterials';
import { DEFAULT_BALL_FOCUS, ballFocusWeight, normalizeBallFocus, type BallFocusSettings } from './ballFocus';
import { AUTHORED_VENUES, isAuthoredVenue, VenueAssetManager, type AuthoredVenueId, type VenueAssetState } from './VenueAssetManager';
import { resolveVenueLighting } from './venueLighting';
import { AudienceSystem, type AudienceState } from './AudienceSystem';
import type { CompiledSession } from '../session/compileSession';
import { motionEvent, sampleOpponentTimeline, type MotionEvent, type MotionSample } from '../session/opponentTimeline';
import { sampleCameraTimeline } from '../session/cameraTimeline';
import { overheadPracticeCamera } from '../session/practiceReturn';
import { cameraExchangeAt, tennisCameraPhase } from '../session/tennisCamera';
import { RETURN_LANDING_LIMITS } from '../session/returnLandingZone';
import { planRecovery } from '../session/opponentMovement';
import { ContinuousPracticePreview } from '../session/practicePreview';
import { sessionFlights } from '../session/sessionFlights';
import type { CompiledRepetition } from '../session/compileSession';
import { LandingZoneControl } from './LandingZoneControl';
import { OpponentPositionControl } from './OpponentPositionControl';
import { landingZoneLimits, type LandingZone } from '../trajectory/landingZone';
import { SHOTS } from '../../content/bundled';
import { RendererProfiler } from './RendererProfiler';
import { PracticePreviewWorker } from '../session/PracticePreviewWorker';

export type CameraConfiguration = Readonly<{
  eyeHeight: number;
  behindBaseline: number;
  lateral: number;
  yaw: number;
  pitch: number;
  fov: number;
}>;

export type SceneMetrics = Readonly<{
  fps: number;
  frameMs: number;
  pixelRatio: number;
  renderer: string;
  quality: QualityMode;
  drawCalls: number;
  triangles: number;
  textures: number;
  venueAsset: VenueAssetState & { hasAsset: boolean };
  audience: AudienceState;
  practiceIssue?: string;
}>;

export type QualityMode = 'auto' | 'performance' | 'quality';

export type CameraMotion = Readonly<{
  from: CameraConfiguration;
  to: CameraConfiguration;
  duration: number;
  delay?: number;
}>;

export type ClosestScreenPoint = Readonly<{
  alpha: number;
  distancePx: number;
}>;

export const closestPointOnScreenSegment = (
  pointer: Readonly<{ x: number; y: number }>,
  start: Readonly<{ x: number; y: number }>,
  end: Readonly<{ x: number; y: number }>,
): ClosestScreenPoint => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const alpha = lengthSquared <= Number.EPSILON
    ? 0
    : THREE.MathUtils.clamp(((pointer.x - start.x) * dx + (pointer.y - start.y) * dy) / lengthSquared, 0, 1);
  const nearestX = start.x + dx * alpha;
  const nearestY = start.y + dy * alpha;
  return { alpha, distancePx: Math.hypot(pointer.x - nearestX, pointer.y - nearestY) };
};

export const trajectoryPlaybackState = (
  elapsed: number,
  duration: number,
  loop: boolean,
  interval: number | null,
): Readonly<{ sampleTime: number; visible: boolean }> => {
  if (!loop || interval === null) return { sampleTime: elapsed, visible: true };
  const cycle = Math.max(0.25, interval);
  const sampleTime = ((elapsed % cycle) + cycle) % cycle;
  return { sampleTime, visible: sampleTime <= duration };
};

export const trajectoryPlaybackTimes = (
  elapsed: number,
  duration: number,
  loop: boolean,
  interval: number | null,
): readonly number[] => {
  const currentTime = Math.max(0, elapsed);
  if (!loop || interval === null) return [currentTime];
  const cycle = Math.max(0.25, interval);
  const latestLaunch = Math.floor(currentTime / cycle);
  const earliestActiveLaunch = Math.max(0, Math.ceil((currentTime - duration) / cycle));
  const activeTimes: number[] = [];
  for (let launch = latestLaunch; launch >= earliestActiveLaunch; launch -= 1) {
    const age = currentTime - launch * cycle;
    if (age <= duration) activeTimes.push(age);
  }
  return activeTimes;
};

export class TennisScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly profiler: RendererProfiler | null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(54, 16 / 9, 0.05, 350);
  private readonly ball: THREE.Mesh;
  private readonly balls: THREE.Mesh[] = [];
  private readonly ballMaterial: THREE.MeshStandardMaterial;
  private ballFocus = DEFAULT_BALL_FOCUS;
  private highContrastBall = false;
  private readonly focusPoint = new THREE.Vector3();
  private readonly focusProjection = new THREE.Matrix4();
  private readonly focusFrustum = new THREE.Frustum();
  private readonly focusLight = new THREE.Color(0xffffdc);
  private readonly focusEmission = new THREE.Color(0xfff7b3);
  private readonly trajectoryLine: THREE.Line;
  private readonly playerPreviewLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x48b8ff, transparent: true, opacity: .6, toneMapped: false }));
  private trajectoryVisible = true;
  private shotPreviewPending = false;
  private readonly ballTrail: THREE.Line;
  private readonly trailPositions = new THREE.BufferAttribute(new Float32Array(30), 3).setUsage(THREE.DynamicDrawUsage);
  private readonly hemisphere: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly opponent = new OpponentRig();
  private motionPreview: ((time: number) => MotionSample | null) | null = null;
  /** Local motion review uses the production rig and renderer, at the same clock. */
  setOpponentMotionPreview(preview: ((time: number) => MotionSample | null) | null): void { this.motionPreview = preview; }
  private readonly fallbackBallMachine: THREE.Object3D | undefined;
  private readonly authoredArenas: Readonly<Record<AuthoredVenueId, VenueAssetManager>>;
  private readonly audience = new AudienceSystem();
  private surface: SurfaceId = 'hard';
  private venueReview = false;
  private reviewRoofVisible = true;
  private courtOverview = false;
  private readonly setCourtSurface: (surface: SurfaceId) => void;
  private readonly materialBundle: SceneMaterialBundle;
  private readonly skySystem: DynamicSkySystem;
  private readonly weatherSystem: WeatherSystem;
  private readonly resizeObserver: ResizeObserver;
  private readonly aimRaycaster = new THREE.Raycaster();
  private readonly aimPointer = new THREE.Vector2();
  private readonly courtPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly courtIntersection = new THREE.Vector3();
  private trajectory: ResolvedTrajectory | null = null;
  private session: CompiledSession | null = null;
  private sessionClock: Readonly<{ current: number }> | null = null;
  private motionEvents: readonly MotionEvent[] = [];
  private practicePreview: ContinuousPracticePreview | null = null;
  private previewCycle = -1;
  readonly landingZoneControl: LandingZoneControl;
  readonly opponentPositionControl: OpponentPositionControl;
  readonly returnLandingZoneControl: LandingZoneControl;
  private authoredNearLandingZone: LandingZone | null = null;
  private onSessionIndex: ((index:number, repetition: CompiledRepetition)=>void) | null = null;
  private sessionIndex = -1;
  private lineTrajectory: ResolvedTrajectory | null = null;
  private baseCameraConfiguration: CameraConfiguration | null = null;
  private previewEvent: MotionEvent | null = null;
  private elapsed = 0;
  private running = true;
  private active = true;
  private sessionRevision = 0;
  private playbackRate = 1;
  private loopTrajectory = true;
  private trajectoryInterval: number | null = null;
  private showBallTrail = false;
  private cameraMotion: CameraMotion | null = null;
  private sessionCameraEnabled = false;
  private lastFrame = performance.now();
  private metricStartedAt = performance.now();
  private metricFrames = 0;
  private qualityMode: QualityMode = 'auto';
  private autoPerformance = false;
  private adaptivePixelRatio = Math.min(window.devicePixelRatio, 1.75);
  private resizePending = true;
  private readonly rendererSize = new THREE.Vector2();
  private slowMetricWindows = 0;
  private environmentConfiguration = DEFAULT_ENVIRONMENT;
  private cameraConfiguration: CameraConfiguration = {
    eyeHeight: 1.7,
    behindBaseline: 1.5,
    lateral: 0,
    yaw: 0,
    pitch: -1.7,
    fov: 70,
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onMetrics?: (metrics: SceneMetrics) => void,
    options: Readonly<{ quality?: QualityMode; environment?: EnvironmentConfiguration; profile?: boolean }> = {},
  ) {
    this.canvas.dataset.sceneInstance = crypto.randomUUID();
    this.canvas.dataset.sceneActive = 'true';
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.5;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.profiler = (options.profile ?? new URLSearchParams(window.location.search).get('profileRenderer') === '1')
      ? new RendererProfiler(this.renderer.getContext() as WebGL2RenderingContext) : null;

    this.scene.background = new THREE.Color(0x8fc5eb);
    this.scene.fog = new THREE.Fog(0x8fc5eb, 47, 105);

    this.hemisphere = new THREE.HemisphereLight(0xd9efff, 0x426342, 2.1);
    this.scene.add(this.hemisphere);
    this.sun = new THREE.DirectionalLight(0xfff5d7, 4.25);
    this.sun.position.set(-12, 22, -11);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -19;
    this.sun.shadow.camera.right = 19;
    this.sun.shadow.camera.top = 25;
    this.sun.shadow.camera.bottom = -20;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 300;
    this.sun.shadow.bias = -.00008;
    this.sun.shadow.normalBias = .035;
    this.sun.shadow.radius = 2;
    this.scene.add(this.sun);

    this.scene.add(this.sun.target);
    this.skySystem = new DynamicSkySystem(this.scene, this.renderer, this.sun, this.hemisphere);
    this.weatherSystem = new WeatherSystem(this.scene);

    const court = createCourt('hard');
    this.setCourtSurface = court.setSurface;
    this.materialBundle = court.materialBundle;
    this.authoredArenas = Object.fromEntries(Object.keys(AUTHORED_VENUES).map(id => {
      const manager = new VenueAssetManager(() => this.syncArenaPresentation(), id as AuthoredVenueId);
      this.scene.add(manager.group);
      return [id, manager];
    })) as Record<AuthoredVenueId, VenueAssetManager>;
    this.scene.add(court.group);
    this.landingZoneControl = new LandingZoneControl(this.camera, canvas, { sharedCursor: true });
    this.scene.add(this.landingZoneControl.root);
    this.opponentPositionControl = new OpponentPositionControl(this.camera, canvas);
    this.scene.add(this.opponentPositionControl.root);
    this.returnLandingZoneControl = new LandingZoneControl(this.camera, canvas, { color: 0x48b8ff, name: 'ReturnLandingZone', showBounce: false, sharedCursor: true });
    this.scene.add(this.returnLandingZoneControl.root);
    this.playerPreviewLine.visible = false;
    this.scene.add(this.playerPreviewLine);
    this.scene.add(this.audience.group);
    this.scene.add(this.opponent.group);
    this.fallbackBallMachine = court.group.getObjectByName('temporary-ball-machine');
    void this.opponent.load().then(() => {
      this.canvas.dataset.opponentAsset = 'ready';
      if (this.fallbackBallMachine) this.fallbackBallMachine.visible = false;
    }).catch((error: unknown) => {
      if (error instanceof OpponentRigDisposedError) return;
      console.warn('Neutral opponent failed to load; keeping the ball-machine fallback.', error);
      if (this.fallbackBallMachine) this.fallbackBallMachine.visible = true;
    });

    this.ballMaterial = new THREE.MeshStandardMaterial({
      color: BALL_PRESENTATION.standard.color,
      emissive: BALL_PRESENTATION.standard.emissive,
      emissiveIntensity: BALL_PRESENTATION.standard.emissiveIntensity,
      roughness: 0.84,
      metalness: 0,
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(COURT.ballRadius * 1.34, 24, 16), this.ballMaterial);
    this.ball.castShadow = true;
    this.balls.push(this.ball);
    this.scene.add(this.ball);

    this.trajectoryLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: BALL_PRESENTATION.trajectoryColor, transparent: true, opacity: 0.56 }),
    );
    this.scene.add(this.trajectoryLine);
    this.ballTrail = new THREE.Line(
      new THREE.BufferGeometry().setAttribute('position', this.trailPositions),
      new THREE.LineBasicMaterial({ color: BALL_PRESENTATION.trailColor, transparent: true, opacity: 0.52 }),
    );
    this.ballTrail.visible = false;
    this.scene.add(this.ballTrail);

    this.setCamera(this.cameraConfiguration);
    this.setQualityMode(options.quality ?? 'auto');
    this.setEnvironment(options.environment ?? DEFAULT_ENVIRONMENT);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.renderer.setAnimationLoop(this.animate);
  }

  setTrajectory(trajectory: ResolvedTrajectory): void {
    if (this.trajectory === trajectory) return;
    this.trajectory = trajectory;
    if (!this.session) this.elapsed = 0;
    const family = trajectory.intent.shotType ?? trajectory.intent.family;
    this.previewEvent = motionEvent({ index: 0, startTime: 3, shot: {
      ...SHOTS[0]!, ...trajectory.intent, family: family === 'serve' || family === 'overhead' || family === 'volley' || family === 'lob' ? family : 'groundstroke',
      opponentHand: trajectory.intent.opponentHand ?? 'right', paceKmh: trajectory.resolved.launchSpeedKmh,
    } });
    if (this.fallbackBallMachine) {
      this.fallbackBallMachine.position.x = trajectory.intent.source.x;
      this.fallbackBallMachine.position.z = trajectory.intent.source.z;
    }
    this.setTrajectoryLine(trajectory);
  }

  private setTrajectoryLine(trajectory: ResolvedTrajectory): void {
    trajectory = this.session?.shotPreview?.opponent ?? this.session?.shotPreview?.player ?? trajectory;
    if (this.session?.mode === 'quick-practice' && trajectory.intent.source.z < 0) return;
    if(this.lineTrajectory===trajectory)return;
    this.lineTrajectory=trajectory;
    (this.trajectoryLine.material as THREE.LineBasicMaterial).color.setHex(this.session?.shotPreview && trajectory.intent.source.z < 0 ? 0x48b8ff : BALL_PRESENTATION.trajectoryColor);
    // The editable incoming zone stays on the near court while its return flies
    // through the separately edited blue zone. Never rebind one control to both.
    if (trajectory.intent.source.z >= 0 && !this.authoredNearLandingZone) {
      this.landingZoneControl.setZone(trajectory.intent.landingZone ?? null,
        landingZoneLimits(trajectory.intent.shotType ?? trajectory.intent.family ?? 'groundstroke', trajectory.intent.source));
    }
    this.updateBounceMarkers();
    const points = trajectory.samples.map(
      (sample) => new THREE.Vector3(sample.position.x, sample.position.y, sample.position.z),
    );
    this.trajectoryLine.geometry.dispose();
    this.trajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
  }

  setSession(session: CompiledSession | null, clock: Readonly<{ current: number }> | null, onIndex?: (index:number, repetition: CompiledRepetition)=>void): void {
    this.onSessionIndex = onIndex ?? null;
    if (this.session === session && this.sessionClock === clock) return;
    this.profiler?.reset();
    this.landingZoneControl.acceptModel();
    this.canvas.dataset.sessionRevision = String(++this.sessionRevision);
    // A rehearsal owns a new clock even when its cached session is reused.
    // Reset before rendering; never retain the preview's phase until the next tick.
    this.elapsed = clock?.current ?? 0; this.sessionIndex = -1;
    this.canvas.dataset.sessionTime = this.elapsed.toFixed(4);
    for (const ball of this.balls) ball.visible = false;
    this.ballTrail.visible = false;
    this.session = session;
    this.canvas.dataset.sessionCategory = session?.drill.category ?? '';
    this.playerPreviewLine.geometry.dispose();
    const player = session?.shotPreview?.opponent && session.shotPreview.player;
    this.playerPreviewLine.geometry = new THREE.BufferGeometry().setFromPoints(player?.samples.map(sample => new THREE.Vector3(sample.position.x, sample.position.y, sample.position.z)) ?? []);
    this.lineTrajectory = null;
    const path = session?.mode === 'quick-practice' ? session.repetitions[0]?.trajectory
      : session?.shotPreview?.opponent ?? session?.shotPreview?.player ?? this.trajectory;
    if (path) this.setTrajectoryLine(path);
    this.setShotPreviewPending(this.shotPreviewPending);
    this.sessionClock = clock;
    this.onSessionIndex=onIndex??null;
    this.motionEvents = session?.repetitions.map(motionEvent) ?? [];
    this.practicePreview?.dispose();
    this.practicePreview = session?.previewLoop ? new ContinuousPracticePreview(session, new PracticePreviewWorker()) : null;
    this.previewCycle = -1;
  }

  setLandingZoneInteraction(onChange: ((zone: LandingZone) => void) | null): void {
    this.landingZoneControl.configure(onChange);
  }

  /** An editor-selected response zone stays attached to its event throughout playback. */
  setNearLandingZone(zone: LandingZone | null, limits?: LandingZone): void {
    this.authoredNearLandingZone = zone;
    this.landingZoneControl.acceptModel();
    const incoming = this.trajectory && this.trajectory.intent.source.z >= 0 ? this.trajectory : null;
    this.landingZoneControl.setZone(zone ?? incoming?.intent.landingZone ?? null,
      limits ?? landingZoneLimits(incoming?.intent.shotType ?? incoming?.intent.family ?? 'groundstroke', incoming?.intent.source ?? { x: 0 }));
  }

  setReturnLandingZone(zone: LandingZone | null, onChange: ((zone: LandingZone) => void) | null): void {
    this.returnLandingZoneControl.configure(onChange);
    this.returnLandingZoneControl.acceptModel();
    this.returnLandingZoneControl.setZone(zone, RETURN_LANDING_LIMITS);
  }

  setTrajectoryVisible(visible: boolean): void {
    this.trajectoryVisible = visible;
    this.setShotPreviewPending(this.shotPreviewPending);
  }

  setOpponentLandingZoneVisible(visible: boolean): void {
    this.landingZoneControl.setVisible(visible);
    this.canvas.dataset.opponentLandingZoneVisible = String(visible);
  }

  setBallPresentation(highContrast: boolean, showTrail: boolean): void {
    this.highContrastBall = highContrast;
    this.showBallTrail = showTrail;
    this.ballTrail.visible = showTrail;
    for (const ball of this.balls) ball.scale.setScalar(highContrast ? 1.24 : 1);
    const presentation = highContrast ? BALL_PRESENTATION.highContrast : BALL_PRESENTATION.standard;
    this.ballMaterial.color.setHex(presentation.color);
    this.ballMaterial.emissive.setHex(presentation.emissive);
    this.ballMaterial.emissiveIntensity = presentation.emissiveIntensity;
  }

  private updateBounceMarkers(): void {
    const preview = this.session?.shotPreview;
    const near = preview ? preview.opponent : this.lineTrajectory && this.lineTrajectory.intent.source.z >= 0 ? this.lineTrajectory : null;
    const far = preview?.player;
    this.landingZoneControl.setBounce(this.shotPreviewPending ? null : near?.events.find(event => event.type === 'bounce')?.position ?? null, near?.intent.landingZone ?? null);
    this.returnLandingZoneControl.setBounceVisible(!!preview && !this.shotPreviewPending);
    this.returnLandingZoneControl.setBounce(this.shotPreviewPending ? null : far?.events.find(event => event.type === 'bounce')?.position ?? null, far?.intent.landingZone ?? null);
  }

  setShotPreviewPending(pending: boolean): void {
    this.shotPreviewPending = pending;
    this.trajectoryLine.visible = this.trajectoryVisible && !pending && !(this.session?.mode === 'quick-practice' && (this.lineTrajectory?.intent.source.z ?? 0) < 0);
    this.playerPreviewLine.visible = this.session?.mode !== 'quick-practice' && this.trajectoryVisible && !pending && !!this.session?.shotPreview?.player && !!this.session.shotPreview.opponent;
    this.canvas.dataset.trajectoryVisible = String(this.trajectoryLine.visible);
    this.updateBounceMarkers();
    this.canvas.dataset.shotPreviewPending = String(pending);
  }

  setBallFocus(settings: BallFocusSettings): void {
    this.ballFocus = normalizeBallFocus(settings);
    this.canvas.dataset.ballFocus = String(this.ballFocus.enabled);
  }

  private updateBallHighlight(): void {
    let target = 0;
    this.camera.updateMatrixWorld();
    if (this.ballFocus.enabled) this.focusFrustum.setFromProjectionMatrix(
      this.focusProjection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse));
    const presentation = this.highContrastBall ? BALL_PRESENTATION.highContrast : BALL_PRESENTATION.standard;
    for (const ball of this.balls) {
      let weight = 0;
      if (this.ballFocus.enabled && ball.visible) {
        // Match the rendered ball bounds, including its high-contrast scale. Keep
        // partially visible balls focused, then clear on the first off-frame draw.
        ball.updateWorldMatrix(true, false);
        if (this.focusFrustum.intersectsObject(ball)) {
          this.focusPoint.copy(ball.position).applyMatrix4(this.camera.matrixWorldInverse);
          const forward = -this.focusPoint.z;
          weight = ballFocusWeight(ball.position.z, ball.userData.focusSourceZ, this.camera.position.z, forward);
        }
      }
      target = Math.max(target, weight);
      ball.userData.focusWeight = weight;
      const material = ball.material as THREE.MeshStandardMaterial;
      material.color.setHex(presentation.color).lerp(this.focusLight, weight * .62);
      material.emissive.setHex(presentation.emissive).lerp(this.focusEmission, weight);
      material.emissiveIntensity = presentation.emissiveIntensity + weight * .55;
    }
    this.canvas.dataset.ballFocusStrength = target.toFixed(4);
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = Math.min(2, Math.max(0.2, rate));
  }

  setLoopTrajectory(loop: boolean): void {
    this.loopTrajectory = loop;
  }

  setTrajectoryInterval(seconds: number | null): void {
    this.trajectoryInterval = seconds === null ? null : Math.max(0.25, seconds);
    this.elapsed = 0;
  }

  setCameraMotion(motion: CameraMotion | null): void {
    this.cameraMotion = motion;
    if(!motion&&this.baseCameraConfiguration){this.cameraConfiguration=this.baseCameraConfiguration;this.applyCamera();}
  }

  setSurface(surface: SurfaceId): void {
    this.surface = surface;
    this.setCourtSurface(surface);
    this.syncArenaPresentation();
  }

  private syncArenaPresentation(): void {
    const arena = this.activeAuthoredArena;
    const ready = arena?.hasAsset;
    this.canvas.dataset.venueAsset = arena?.state.status ?? 'idle';
    this.canvas.dataset.authoredVenue = ready ? this.environmentConfiguration.venue : '';
    this.canvas.dataset.venueSource = ready ? 'blender' : arena?.state.status === 'error' ? 'error' : 'loading';
    this.canvas.dataset.venueVariant = arena?.renderedVariant ?? arena?.variant ?? 'quality';
    this.audience.apply(this.environmentConfiguration.venue, ready ? arena.audienceManifest : undefined,
      this.environmentConfiguration.audience, arena?.renderedVariant ?? arena?.variant ?? 'quality');
    // Fabric casts one continuous shade, with a bounded diffuse-light allowance.
    // Reset on every asset/venue/cutaway transition; hard and fallback stay intact.
    this.sun.shadow.intensity = ready && arena ? arena.sunShadowIntensity : 1;
    this.sun.shadow.radius = this.sun.shadow.intensity < 1 ? 4 : 2;
    this.canvas.dataset.sunShadowIntensity = String(this.sun.shadow.intensity);
    arena?.applySurface(this.surface, this.materialBundle,
      this.environmentConfiguration.weather === 'rain' ? this.environmentConfiguration.weatherIntensity : 0);
    // All venue bowls/roofs must participate, not just the playing rectangle.
    this.sun.shadow.camera.left = -60;
    this.sun.shadow.camera.right = 60;
    this.sun.shadow.camera.top = 60;
    this.sun.shadow.camera.bottom = -60;
    this.sun.shadow.camera.updateProjectionMatrix();
    if (ready && this.scene.fog instanceof THREE.Fog && this.venueReview) {
      this.scene.fog.near = 200;
      this.scene.fog.far = 500;
    }
    if (ready && arena) this.applyVenueFixtures(arena.group);
  }

  private get activeAuthoredArena(): VenueAssetManager | undefined {
    const id = this.environmentConfiguration.venue;
    return isAuthoredVenue(id) ? this.authoredArenas[id] : undefined;
  }

  /** Inspection-only cutaway; never changes gameplay or the exported master. */
  setVenueReview(roofVisible: boolean): void {
    this.venueReview = true;
    this.reviewRoofVisible = roofVisible;
    this.syncRoofVisibility();
  }

  /** Temporary editing cutaway, independent of the saved player camera. */
  setCourtOverview(enabled: boolean): void {
    this.courtOverview = enabled;
    this.canvas.dataset.courtOverview = String(enabled);
    this.syncRoofVisibility();
  }

  private syncRoofVisibility(): void {
    // Apply to inactive managers too: asynchronous loads and quality/venue
    // switches must inherit the cutaway before their first visible frame.
    for (const arena of Object.values(this.authoredArenas)) arena.setRoofVisible(this.reviewRoofVisible && !this.courtOverview);
    this.syncArenaPresentation();
  }

  private applyVenueFixtures(group: THREE.Group): void {
    const configuration = this.environmentConfiguration;
    const { fixtureScale } = resolveVenueLighting(configuration);
    const intensity = Math.min(1.5, Math.max(.35, configuration.lightIntensity));
    group.traverse(object => {
      if (!(object instanceof THREE.PointLight || object instanceof THREE.SpotLight)) return;
      object.intensity = Number(object.userData.baseIntensity ?? 35) * intensity * fixtureScale;
      // Three still generates/evaluates lighting code for visible zero lights.
      // Restore them for dusk/night/indoors; never discard a nonzero contribution.
      object.visible = object.intensity > 0;
      object.color.setHex(configuration.lighting === 'indoor-warm' ? 0xffd09a : 0xe7f2ff);
    });
  }

  setEnvironment(configuration: EnvironmentConfiguration): void {
    this.profiler?.reset();
    this.environmentConfiguration = configuration;
    this.canvas.dataset.venue = configuration.venue;
    this.canvas.dataset.timeOfDay = String(configuration.timeOfDay);
    const definition = SCENE_DEFINITIONS[configuration.venue];
    this.renderer.toneMappingExposure = resolveVenueLighting(configuration).exposure;
    this.skySystem.apply(configuration, definition);
    this.weatherSystem.apply(configuration);
    const wind = windVelocityFromEnvironment(configuration);
    updateSceneMaterialEnvironment(this.materialBundle, this.elapsed, configuration.weather === 'rain' ? configuration.weatherIntensity * 0.86 : 0, wind.x, wind.z);
    // Release deselected resources before activating the next venue.
    for (const [id, arena] of Object.entries(this.authoredArenas)) if (configuration.venue !== id) arena.setActive(false);
    this.authoredArenas[configuration.venue].setActive(true);
    this.syncArenaPresentation();
  }

  setQualityMode(mode: QualityMode): void {
    this.qualityMode = mode;
    this.autoPerformance = mode === 'auto' && window.innerWidth < 650;
    this.slowMetricWindows = 0;
    this.adaptivePixelRatio = mode === 'performance'
      ? Math.min(window.devicePixelRatio, 1)
      : mode === 'quality'
        ? Math.min(window.devicePixelRatio, 1.75)
        : Math.min(window.devicePixelRatio, 1.5);
    const shadowSize = Math.min(this.renderer.capabilities.maxTextureSize, mode === 'quality' ? 4096 : 2048);
    if (this.sun.shadow.mapSize.x !== shadowSize) {
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.mapSize.set(shadowSize, shadowSize);
      this.sun.shadow.needsUpdate = true;
    }
    this.resize();
    for (const arena of Object.values(this.authoredArenas)) arena.setVariant(mode === 'performance' || this.autoPerformance ? 'performance' : 'quality');
  }

  retryVenue(): void { this.activeAuthoredArena?.retry(); this.audience.retry(); this.syncArenaPresentation(); }

  setCamera(configuration: CameraConfiguration): void {
    this.baseCameraConfiguration=configuration;
    this.cameraConfiguration = configuration;
    this.applyCamera();
  }

  aimDirectionFromClientPoint(clientX: number, clientY: number): number | null {
    if (!this.trajectory) return null;
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    this.aimPointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -(((clientY - bounds.top) / bounds.height) * 2 - 1),
    );
    this.aimRaycaster.setFromCamera(this.aimPointer, this.camera);
    const point = this.aimRaycaster.ray.intersectPlane(this.courtPlane, this.courtIntersection);
    if (!point || Math.abs(point.x) > COURT.doublesWidth / 2 || Math.abs(point.z) > COURT.halfLength) return null;
    return aimDirectionToCourtPoint(this.trajectory.intent.source, point);
  }

  getDisplayedTrajectory(): ResolvedTrajectory | null { return this.lineTrajectory; }
  getDisplayedTrajectories(): readonly ResolvedTrajectory[] {
    return !this.trajectoryLine.visible || !this.lineTrajectory ? [] : this.playerPreviewLine.visible && this.session?.shotPreview?.player
      ? [this.lineTrajectory, this.session.shotPreview.player] : [this.lineTrajectory];
  }

  projectCourtPoint(point: Readonly<{x:number;y?:number;z:number}>): {x:number;y:number} | null {
    const p=new THREE.Vector3(point.x,point.y??COURT.ballRadius,point.z).project(this.camera);
    if(p.z < -1 || p.z > 1 || Math.abs(p.x)>1 || Math.abs(p.y)>1)return null;
    return {x:(p.x*.5+.5)*this.canvas.clientWidth,y:(-.5*p.y+.5)*this.canvas.clientHeight};
  }

  /** Playback opts in; editors and MotionLab keep their inspection camera. */
  setSessionCameraEnabled(enabled: boolean): void { this.sessionCameraEnabled = enabled; }

  courtPointFromClientPoint(clientX:number,clientY:number): {x:number;z:number} | null {
    const bounds=this.canvas.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return null;
    this.aimPointer.set((clientX-bounds.left)/bounds.width*2-1,1-(clientY-bounds.top)/bounds.height*2);
    this.aimRaycaster.setFromCamera(this.aimPointer,this.camera);
    const point=this.aimRaycaster.ray.intersectPlane(this.courtPlane,this.courtIntersection);
    return point && Math.abs(point.x)<100 && Math.abs(point.z)<100 ? {x:point.x,z:point.z}:null;
  }

  trajectorySampleFromClientPoint(clientX: number, clientY: number, thresholdPx = 11, trajectory = this.lineTrajectory): FlightSample | null {
    if (!trajectory || !this.trajectoryLine.visible) return null;
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const pointer = { x: clientX - bounds.left, y: clientY - bounds.top };
    const projected = new THREE.Vector3();
    const project = (sample: FlightSample) => {
      projected.set(sample.position.x, sample.position.y, sample.position.z).project(this.camera);
      return {
        x: (projected.x * 0.5 + 0.5) * bounds.width,
        y: (-projected.y * 0.5 + 0.5) * bounds.height,
        depth: projected.z,
      };
    };
    let closest: Readonly<{ left: FlightSample; right: FlightSample; alpha: number; distancePx: number }> | null = null;
    for (let index = 1; index < trajectory.samples.length; index += 1) {
      const left = trajectory.samples[index - 1];
      const right = trajectory.samples[index];
      if (!left || !right) continue;
      const start = project(left);
      const end = project(right);
      if (start.depth < -1 || start.depth > 1 || end.depth < -1 || end.depth > 1) continue;
      const candidate = closestPointOnScreenSegment(pointer, start, end);
      if (!closest || candidate.distancePx < closest.distancePx) closest = { left, right, ...candidate };
    }
    if (!closest || closest.distancePx > thresholdPx) return null;
    const mix = (left: number, right: number) => THREE.MathUtils.lerp(left, right, closest.alpha);
    return {
      time: mix(closest.left.time, closest.right.time),
      position: {
        x: mix(closest.left.position.x, closest.right.position.x),
        y: mix(closest.left.position.y, closest.right.position.y),
        z: mix(closest.left.position.z, closest.right.position.z),
      },
      velocity: {
        x: mix(closest.left.velocity.x, closest.right.velocity.x),
        y: mix(closest.left.velocity.y, closest.right.velocity.y),
        z: mix(closest.left.velocity.z, closest.right.velocity.z),
      },
      bounced: closest.alpha < 0.5 ? closest.left.bounced : closest.right.bounced,
    };
  }

  private ensureBallCount(count: number): void {
    while (this.balls.length < count) {
      const ball = new THREE.Mesh(this.ball.geometry, this.ballMaterial.clone());
      ball.castShadow = true;
      ball.scale.copy(this.ball.scale);
      this.balls.push(ball);
      this.scene.add(ball);
    }
  }

  private applyCamera(): void {
    const configuration = this.cameraConfiguration;
    const horizontalRadians = THREE.MathUtils.degToRad(configuration.fov);
    this.camera.fov = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(horizontalRadians / 2) / this.camera.aspect),
    );
    this.camera.position.set(
      configuration.lateral,
      configuration.eyeHeight,
      -(COURT.halfLength + configuration.behindBaseline),
    );
    const rotation = cameraRotationRadians(configuration);
    this.camera.rotation.set(rotation.pitch, rotation.yaw, 0, 'YXZ');
    this.camera.updateProjectionMatrix();
  }

  onPreviewAudioFrame?: PreviewAudioFrame;

  setRunning(running: boolean): void {
    this.running = running;
    this.lastFrame = performance.now();
  }

  /** Keep GPU resources resident while a route without a court is displayed. */
  setActive(active: boolean): void {
    this.profiler?.reset();
    if (this.active === active) return;
    this.active = active;
    this.canvas.dataset.sceneActive = String(active);
    this.lastFrame = performance.now();
    this.metricStartedAt = this.lastFrame; this.metricFrames = 0;
    if (active) this.resize();
    this.renderer.setAnimationLoop(active ? this.animate : null);
  }

  reset(): void {
    this.elapsed = 0;
  }

  private readonly animate = (now: number): void => {
    this.resizeBeforeRender();
    this.profiler?.beginFrame(now, document.visibilityState === 'visible');
    const delta = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    if (this.sessionClock) this.elapsed = this.sessionClock.current;
    else if (this.running) this.elapsed += delta * this.playbackRate;
    if(this.session&&!this.session.previewLoop&&!this.session.planningIssues?.length&&!this.sessionClock&&this.loopTrajectory&&this.session.duration>0)this.elapsed%=this.session.duration;
    this.skySystem.update(now);
    this.weatherSystem.update(this.elapsed);
    const wind = windVelocityFromEnvironment(this.environmentConfiguration);
    updateSceneMaterialEnvironment(
      this.materialBundle,
      this.elapsed,
      this.environmentConfiguration.weather === 'rain' ? this.environmentConfiguration.weatherIntensity * 0.86 : 0,
      wind.x,
      wind.z,
    );
    this.profiler?.mark('environment');
    let opponentRoot: MotionSample['root'] | undefined;
    let practiceRepetition: CompiledRepetition | undefined;
    const audioFlights: { trajectory: ResolvedTrajectory; time: number }[] = [];
    if (this.trajectory) {
      const duration = this.trajectory.samples.at(-1)?.time ?? 0;
      let events = this.motionEvents;
      let motionTime = this.elapsed;
      const visibleFlights: { trajectory: ResolvedTrajectory; time: number }[] = [];
      if (this.session) {
        const frame=this.practicePreview?.frame(this.elapsed);
        const flights=frame?.flights ?? sessionFlights(this.session,this.elapsed);
        if (frame) events=frame.events;
        this.canvas.dataset.previewCycle=String(frame?.cycle ?? 0);
        this.canvas.dataset.previewNextContact=String(frame?.nextContact ?? 0);
        visibleFlights.push(...flights);
        audioFlights.push(...flights);
        this.canvas.dataset.ballPhase=flights[0]?.phase??'none';
        this.canvas.dataset.sessionTime=this.elapsed.toFixed(4);
        const repetition=frame?.repetition ?? this.session.repetitions.reduce((active,rep)=>motionTime>=rep.startTime?rep:active,this.session.repetitions[0]!);
        practiceRepetition = repetition;
        if (repetition) {
          const index=repetition.index, cycle=frame?.cycle??0;
          if(index!==this.sessionIndex || cycle!==this.previewCycle){this.sessionIndex=index;this.previewCycle=cycle;this.onSessionIndex?.(index,repetition);}
        }
        const path = this.session.mode === 'quick-practice' ? repetition?.trajectory : flights[0]?.trajectory ?? repetition?.trajectory;
        if (path) this.setTrajectoryLine(path);
      } else if (this.previewEvent) {
        const interval = Math.max(this.previewEvent.end-this.previewEvent.start+planRecovery(this.previewEvent,this.previewEvent).requiredDuration, this.trajectoryInterval ?? duration + .5);
        const cycle = this.loopTrajectory ? Math.max(0, Math.floor((this.elapsed - 3) / interval)) : 0;
        const shiftEvent = (offset: number): MotionEvent => ({ ...this.previewEvent!, index: offset,
          start: this.previewEvent!.start + offset * interval, end: this.previewEvent!.end + offset * interval,
          contactTime: 3 + offset * interval });
        events = [shiftEvent(0), shiftEvent(1), shiftEvent(2)];
        if (cycle > 0) motionTime = this.elapsed - (cycle - 1) * interval;
        else events = this.loopTrajectory ? events : [shiftEvent(0)];
        const first = this.loopTrajectory ? Math.max(0, cycle - Math.ceil(duration / interval)) : 0;
        for (let index = cycle; index >= first; index -= 1) {
          const age = this.elapsed - 3 - index * interval;
          if (age >= 0 && age <= duration) visibleFlights.push({ trajectory: this.trajectory, time: age });
        }
      }
      this.profiler?.mark('session');
      const placement = this.opponentPositionControl.position ?? this.session?.opponentIdle;
      const motion: MotionSample | null = placement ? { root: { x: placement.x, y: 0, z: placement.z }, yaw: Math.PI, hand: placement.hand,
        layers: [{ clip: 'ready', time: 0, weight: 1 }], event: null, verticalCorrection: 0, toss: null }
        : this.motionPreview ? this.motionPreview(motionTime) : sampleOpponentTimeline(events, motionTime);
      opponentRoot = motion?.root;
      if (motion) {
        this.opponent.sampleMotion(motion);
        this.canvas.dataset.motionClip = motion.layers.find(layer => layer.weight > .5)?.clip ?? 'ready';
        this.canvas.dataset.motionTime = motion.layers[0]?.time.toFixed(4) ?? '0';
        this.canvas.dataset.opponentRoot = [motion.root.x, motion.root.z].map(v => v.toFixed(4)).join(',');
        if (motion.event && Math.abs(motionTime - motion.event.contactTime) < 1 / 60) {
          const contact = this.opponent.getContactPosition();
          if (contact) this.canvas.dataset.contactError = contact.distanceTo(this.focusPoint.set(motion.event.source.x, motion.event.source.y, motion.event.source.z)).toFixed(5);
          else delete this.canvas.dataset.contactError;
        } else delete this.canvas.dataset.contactError;
      }
      this.profiler?.mark('opponent');
      this.ensureBallCount(Math.max(1, visibleFlights.length + (motion?.toss ? 1 : 0)));
      for (let index = 0; index < this.balls.length; index += 1) {
        const ball = this.balls[index]!;
        const flight = visibleFlights[index];
        const toss = index === visibleFlights.length ? motion?.toss : null;
        ball.visible = !this.shotPreviewPending && (!!flight || !!toss);
        if (!ball.visible) continue;
        const position = toss ?? sampleTrajectoryAt(flight!.trajectory, flight!.time, false);
        ball.position.set(position.x, position.y, position.z);
        // A toss or virtual return has not crossed from the opposite court half.
        ball.userData.focusSourceZ = flight?.trajectory.intent.source.z ?? position.z;
      }
      const cycleTime = visibleFlights[0]?.time ?? 0;
      const ballActive = visibleFlights.length > 0;
      this.ballTrail.visible = this.showBallTrail && ballActive && !this.shotPreviewPending
        && !(this.session?.mode === 'quick-practice' && (visibleFlights[0]?.trajectory.intent.source.z ?? 0) < 0);
      if (this.showBallTrail && ballActive) {
        for (let index = 9; index >= 0; index -= 1) {
          const trailPosition = sampleTrajectoryAt(visibleFlights[0]!.trajectory, Math.max(0, cycleTime - index * 0.018), false);
          this.trailPositions.setXYZ(9 - index, trailPosition.x, trailPosition.y, trailPosition.z);
        }
        this.trailPositions.needsUpdate = true;
        this.ballTrail.geometry.computeBoundingSphere();
      }
    } else {
      for (const ball of this.balls) ball.visible = false;
      this.ballTrail.visible = false;
    }
    this.profiler?.mark('balls');
    if (this.sessionCameraEnabled && this.sessionClock && this.session?.mode === 'drill') {
      const camera = sampleCameraTimeline(this.session.cameraTimeline, this.elapsed, opponentRoot, this.camera.aspect);
      const track = this.session.cameraTimeline.tennis, exchange = track && cameraExchangeAt(track, this.elapsed);
      this.canvas.dataset.cameraPhase = exchange ? tennisCameraPhase(exchange, this.elapsed) : 'reset';
      if(camera!==this.cameraConfiguration){this.cameraConfiguration=camera;this.applyCamera();}
    } else if (this.sessionCameraEnabled && !this.courtOverview && this.session?.mode === 'quick-practice'
      && this.session.settings.followPracticeBall && practiceRepetition && this.baseCameraConfiguration) {
      this.cameraConfiguration = overheadPracticeCamera(this.baseCameraConfiguration, practiceRepetition.trajectory,
        this.elapsed - practiceRepetition.startTime, practiceRepetition.rallyReturn?.contactTime ?? practiceRepetition.reachability.contact?.time ?? practiceRepetition.trajectory.samples.at(-1)!.time);
      this.applyCamera();
    } else if (this.cameraMotion) {
      const delay = this.cameraMotion.delay ?? 0;
      const currentContact = this.session ? [...this.session.repetitions].reverse().find(repetition => repetition.startTime <= this.elapsed)?.startTime ?? 3 : 3;
      const raw = Math.min(1, Math.max(0, (this.elapsed - currentContact - delay) / Math.max(0.001, this.cameraMotion.duration)));
      const alpha = raw * raw * (3 - 2 * raw);
      const from = this.cameraMotion.from;
      const to = this.cameraMotion.to;
      this.cameraConfiguration = {
        eyeHeight: THREE.MathUtils.lerp(from.eyeHeight, to.eyeHeight, alpha),
        behindBaseline: THREE.MathUtils.lerp(from.behindBaseline, to.behindBaseline, alpha),
        lateral: THREE.MathUtils.lerp(from.lateral, to.lateral, alpha),
        yaw: THREE.MathUtils.lerp(from.yaw, to.yaw, alpha),
        pitch: THREE.MathUtils.lerp(from.pitch, to.pitch, alpha),
        fov: THREE.MathUtils.lerp(from.fov, to.fov, alpha),
      };
      this.applyCamera();
    }
    this.onPreviewAudioFrame?.(this.elapsed, audioFlights, this.cameraConfiguration);
    this.audience.update(this.elapsed);
    this.landingZoneControl.update();
    this.returnLandingZoneControl.update();
    this.opponentPositionControl.update();
    const cursor = this.opponentPositionControl.cursor || this.returnLandingZoneControl.cursor || this.landingZoneControl.cursor;
    if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;
    this.updateBallHighlight();
    this.profiler?.mark('presentation');
    this.profiler?.beginGpu();
    this.renderer.render(this.scene, this.camera);
    this.profiler?.endGpu();
    this.profiler?.mark('renderSubmit');
    this.metricFrames += 1;
    const metricElapsed = now - this.metricStartedAt;
    if (metricElapsed >= 1000) {
      if (this.profiler) this.canvas.dataset.rendererProfile = JSON.stringify(this.getRendererProfile());
      this.canvas.dataset.landingZone=JSON.stringify(this.lineTrajectory?.intent.landingZone??null);
      this.canvas.dataset.landingTarget=JSON.stringify(this.lineTrajectory?.intent.target??null);
      this.canvas.dataset.actualBounce=JSON.stringify(this.landingZoneControl.displayedBounce);
      this.canvas.dataset.playerBounce=JSON.stringify(this.returnLandingZoneControl.displayedBounce);
      this.canvas.dataset.shotPreview=JSON.stringify(this.session?.shotPreview ? Object.fromEntries(Object.entries(this.session.shotPreview).map(([role, flight]) => [role, { source: flight.intent.source, target: flight.intent.target, zone: flight.intent.landingZone, bounce: flight.events.find(event => event.type === 'bounce')?.position, resolved: flight.resolved }])) : null);
      this.canvas.dataset.landingZoneScreen=JSON.stringify(this.landingZoneControl.screenPoints());
      this.canvas.dataset.returnLandingZoneScreen=JSON.stringify(this.returnLandingZoneControl.screenPoints());
      this.canvas.dataset.opponentPlacementScreen=JSON.stringify(this.opponentPositionControl.screenPoint());
      this.canvas.dataset.zoneSnapshotAt = String(now);
      this.canvas.dataset.cameraPose = JSON.stringify(this.cameraConfiguration);
      this.canvas.dataset.audience = this.audience.state.status;
      this.canvas.dataset.spectators = String(this.audience.state.count);
      this.onMetrics?.({
        fps: Math.round((this.metricFrames * 1000) / metricElapsed),
        frameMs: metricElapsed / this.metricFrames,
        pixelRatio: this.renderer.getPixelRatio(),
        renderer: this.renderer.capabilities.isWebGL2 ? 'WebGL 2' : 'WebGL 1',
        quality: this.qualityMode,
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        textures: this.renderer.info.memory.textures,
        venueAsset: { ...(this.activeAuthoredArena?.state ?? { status: 'idle', loadedBytes: 0, totalBytes: 0 }), hasAsset: this.activeAuthoredArena?.hasAsset ?? false },
        audience: this.audience.state,
        practiceIssue: this.practicePreview?.issue,
      });
      const fps = (this.metricFrames * 1000) / metricElapsed;
      if (this.qualityMode === 'auto') {
        this.slowMetricWindows = fps < 52 ? this.slowMetricWindows + 1 : Math.max(0, this.slowMetricWindows - 1);
        if (this.slowMetricWindows >= 3 && !this.autoPerformance && this.activeAuthoredArena?.state.status === 'ready') {
          this.autoPerformance = true;
          for (const arena of Object.values(this.authoredArenas)) arena.setVariant('performance');
        }
        if (this.slowMetricWindows >= 3 && this.adaptivePixelRatio > 0.8) {
          this.adaptivePixelRatio = Math.max(0.8, this.adaptivePixelRatio - 0.2);
          this.resize();
          this.slowMetricWindows = 0;
        }
      }
      this.metricFrames = 0;
      this.metricStartedAt = now;
    }
    this.profiler?.endFrame();
  };

  /** Opt in with ?profileRenderer=1. No timers or adapter queries otherwise. */
  getRendererProfile() {
    if (!this.profiler) return null;
    return {
      ...this.profiler.snapshot(), visible: document.visibilityState === 'visible',
      buffer: { width: this.canvas.width, height: this.canvas.height, pixels: this.canvas.width * this.canvas.height },
      css: { width: this.canvas.clientWidth, height: this.canvas.clientHeight },
      pixelRatio: this.renderer.getPixelRatio(), quality: this.qualityMode,
      venue: this.environmentConfiguration.venue,
      variant: this.activeAuthoredArena?.renderedVariant ?? this.activeAuthoredArena?.variant,
      requestedVariant: this.activeAuthoredArena?.variant,
      audience: this.audience.state, shadowMapSize: this.sun.shadow.mapSize.x,
      previewPreparation: this.practicePreview?.preparation,
      drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures,
    };
  }

  resetRendererProfile(): void { this.profiler?.reset(); }

  private captureActive = false;

  setCaptureActive(active: boolean): void {
    if (this.captureActive === active) return;
    this.captureActive = active;
    this.resize();
  }

  private resize(): void {
    // A canvas size assignment clears its drawing buffer, even at the same size.
    // ResizeObserver and end-of-frame auto quality must never erase a presented frame.
    this.resizePending = true;
  }

  private resizeBeforeRender(): void {
    if (!this.resizePending) return;
    if (!this.active || !this.canvas.clientWidth || !this.canvas.clientHeight) return;
    this.resizePending = false;
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const pixelRatio = capturePixelRatio(width, height, this.adaptivePixelRatio, this.captureActive);
    this.renderer.getSize(this.rendererSize);
    if (this.rendererSize.x === width && this.rendererSize.y === height && this.renderer.getPixelRatio() === pixelRatio) return;
    this.profiler?.reset();
    this.renderer.setDrawingBufferSize(width, height, pixelRatio);
    this.camera.aspect = width / height;
    this.applyCamera();
  }

  dispose(): void {
    this.profiler?.dispose();
    this.practicePreview?.dispose();
    this.resizeObserver.disconnect();
    this.renderer.setAnimationLoop(null);
    for (const arena of Object.values(this.authoredArenas)) arena.dispose();
    this.audience.dispose();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    // Surface override materials may never have been attached to a mesh.
    for (const material of Object.values(this.materialBundle.materials)) materials.add(material);
    this.scene.traverse((object) => {
      if (
        object.name === 'dynamic-physical-sky'
        || object.name === 'procedural-wind-driven-rain'
      ) return;
      if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments) {
        geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of objectMaterials) materials.add(material);
      }
    });
    for (const material of materials) {
      for (const property of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'emissiveMap'] as const) {
        const texture = (material as THREE.MeshStandardMaterial)[property];
        if (texture instanceof THREE.Texture) textures.add(texture);
      }
    }
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    this.skySystem.dispose();
    this.weatherSystem.dispose();
    this.opponent.dispose();
    this.renderer.dispose();
  }
}
