import * as THREE from 'three';
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
import { AUTHORED_VENUES, isAuthoredVenue, VenueAssetManager, type AuthoredVenueId, type VenueAssetState } from './VenueAssetManager';
import { resolveVenueLighting } from './venueLighting';
import { AudienceSystem, type AudienceState } from './AudienceSystem';
import type { CompiledSession } from '../session/compileSession';
import { motionEvent, motionClip, sampleOpponentTimeline, type MotionEvent, type MotionSample } from '../session/opponentTimeline';
import { SHOTS } from '../../content/bundled';

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
  venueAsset: VenueAssetState;
  audience: AudienceState;
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
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(54, 16 / 9, 0.05, 350);
  private readonly ball: THREE.Mesh;
  private readonly balls: THREE.Mesh[] = [];
  private readonly ballMaterial: THREE.MeshStandardMaterial;
  private readonly trajectoryLine: THREE.Line;
  private readonly ballTrail: THREE.Line;
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
  private previewEvent: MotionEvent | null = null;
  private elapsed = 0;
  private running = true;
  private playbackRate = 1;
  private loopTrajectory = true;
  private trajectoryInterval: number | null = null;
  private showBallTrail = false;
  private cameraMotion: CameraMotion | null = null;
  private lastFrame = performance.now();
  private metricStartedAt = performance.now();
  private metricFrames = 0;
  private qualityMode: QualityMode = 'auto';
  private autoPerformance = false;
  private adaptivePixelRatio = Math.min(window.devicePixelRatio, 1.75);
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
    options: Readonly<{ quality?: QualityMode; environment?: EnvironmentConfiguration }> = {},
  ) {
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
    this.renderer.setPixelRatio(this.adaptivePixelRatio);

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
    this.scene.add(this.audience.group);
    this.scene.add(this.opponent.group);
    this.fallbackBallMachine = court.group.getObjectByName('temporary-ball-machine');
    void this.opponent.load().then(() => {
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
      new THREE.BufferGeometry(),
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
    this.trajectory = trajectory;
    this.elapsed = 0;
    const family = trajectory.intent.shotType ?? trajectory.intent.family;
    this.previewEvent = motionEvent({ index: 0, startTime: 3, shot: {
      ...SHOTS[0]!, ...trajectory.intent, family: family === 'serve' || family === 'overhead' || family === 'volley' || family === 'lob' ? family : 'groundstroke',
      opponentHand: trajectory.intent.opponentHand ?? 'right', paceKmh: trajectory.resolved.launchSpeedKmh,
    } });
    if (this.fallbackBallMachine) {
      this.fallbackBallMachine.position.x = trajectory.intent.source.x;
      this.fallbackBallMachine.position.z = trajectory.intent.source.z;
    }
    const points = trajectory.samples.map(
      (sample) => new THREE.Vector3(sample.position.x, sample.position.y, sample.position.z),
    );
    this.trajectoryLine.geometry.dispose();
    this.trajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
  }

  setSession(session: CompiledSession | null, clock: Readonly<{ current: number }> | null): void {
    this.session = session;
    this.sessionClock = clock;
    this.motionEvents = session?.repetitions.map(motionEvent) ?? [];
  }

  setTrajectoryVisible(visible: boolean): void {
    this.trajectoryLine.visible = visible;
  }

  setBallPresentation(highContrast: boolean, showTrail: boolean): void {
    this.showBallTrail = showTrail;
    this.ballTrail.visible = showTrail;
    for (const ball of this.balls) ball.scale.setScalar(highContrast ? 1.24 : 1);
    const presentation = highContrast ? BALL_PRESENTATION.highContrast : BALL_PRESENTATION.standard;
    this.ballMaterial.color.setHex(presentation.color);
    this.ballMaterial.emissive.setHex(presentation.emissive);
    this.ballMaterial.emissiveIntensity = presentation.emissiveIntensity;
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
  }

  setSurface(surface: SurfaceId): void {
    this.surface = surface;
    this.setCourtSurface(surface);
    this.syncArenaPresentation();
  }

  private syncArenaPresentation(): void {
    const arena = this.activeAuthoredArena;
    const ready = arena?.state.status === 'ready';
    this.canvas.dataset.venueAsset = arena?.state.status ?? 'idle';
    this.canvas.dataset.authoredVenue = ready ? this.environmentConfiguration.venue : '';
    this.canvas.dataset.venueSource = ready ? 'blender' : arena?.state.status === 'error' ? 'error' : 'loading';
    this.canvas.dataset.venueVariant = arena?.variant ?? 'quality';
    this.audience.apply(this.environmentConfiguration.venue, ready ? arena.audienceManifest : undefined,
      this.environmentConfiguration.audience, arena?.variant ?? 'quality');
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
    for (const arena of Object.values(this.authoredArenas)) arena.setRoofVisible(roofVisible);
    this.syncArenaPresentation();
  }

  private applyVenueFixtures(group: THREE.Group): void {
    const configuration = this.environmentConfiguration;
    const { fixtureScale } = resolveVenueLighting(configuration);
    const intensity = Math.min(1.5, Math.max(.35, configuration.lightIntensity));
    group.traverse(object => {
      if (!(object instanceof THREE.PointLight || object instanceof THREE.SpotLight)) return;
      object.intensity = Number(object.userData.baseIntensity ?? 35) * intensity * fixtureScale;
      object.color.setHex(configuration.lighting === 'indoor-warm' ? 0xffd09a : 0xe7f2ff);
    });
  }

  setEnvironment(configuration: EnvironmentConfiguration): void {
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
    this.renderer.setPixelRatio(this.adaptivePixelRatio);
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

  trajectorySampleFromClientPoint(clientX: number, clientY: number, thresholdPx = 11): FlightSample | null {
    if (!this.trajectory || !this.trajectoryLine.visible) return null;
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
    for (let index = 1; index < this.trajectory.samples.length; index += 1) {
      const left = this.trajectory.samples[index - 1];
      const right = this.trajectory.samples[index];
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
      const ball = new THREE.Mesh(this.ball.geometry, this.ballMaterial);
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

  setRunning(running: boolean): void {
    this.running = running;
    this.lastFrame = performance.now();
  }

  reset(): void {
    this.elapsed = 0;
  }

  private readonly animate = (now: number): void => {
    const delta = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    if (this.sessionClock) this.elapsed = this.sessionClock.current;
    else if (this.running) this.elapsed += delta * this.playbackRate;
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
    if (this.trajectory) {
      const duration = this.trajectory.samples.at(-1)?.time ?? 0;
      let events = this.motionEvents;
      let motionTime = this.elapsed;
      const visibleFlights: { trajectory: ResolvedTrajectory; time: number }[] = [];
      if (this.session) {
        for (const repetition of this.session.repetitions) {
          const age = this.elapsed - repetition.startTime;
          if (age >= 0 && age <= (repetition.trajectory.samples.at(-1)?.time ?? 0)) visibleFlights.unshift({ trajectory: repetition.trajectory, time: age });
        }
      } else if (this.previewEvent) {
        const clip = motionClip(this.previewEvent.clip);
        const interval = Math.max(clip.duration + .18, this.trajectoryInterval ?? duration + .5);
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
      const motion = this.motionPreview ? this.motionPreview(motionTime) : sampleOpponentTimeline(events, motionTime);
      if (motion) {
        this.opponent.sampleMotion(motion);
        this.canvas.dataset.motionClip = motion.layers.find(layer => layer.weight > .5)?.clip ?? 'ready';
        this.canvas.dataset.motionTime = motion.layers[0]?.time.toFixed(4) ?? '0';
        this.canvas.dataset.opponentRoot = [motion.root.x, motion.root.z].map(v => v.toFixed(4)).join(',');
        const contact = this.opponent.getContactPosition();
        if (motion.event && contact && Math.abs(motionTime - motion.event.contactTime) < 1 / 60) this.canvas.dataset.contactError = contact.distanceTo(new THREE.Vector3(motion.event.source.x, motion.event.source.y, motion.event.source.z)).toFixed(5);
        else delete this.canvas.dataset.contactError;
      }
      this.ensureBallCount(Math.max(1, visibleFlights.length + (motion?.toss ? 1 : 0)));
      for (let index = 0; index < this.balls.length; index += 1) {
        const ball = this.balls[index]!;
        const flight = visibleFlights[index];
        const toss = index === visibleFlights.length ? motion?.toss : null;
        ball.visible = !!flight || !!toss;
        if (!ball.visible) continue;
        const position = toss ?? sampleTrajectoryAt(flight!.trajectory, flight!.time, false);
        ball.position.set(position.x, position.y, position.z);
      }
      const cycleTime = visibleFlights[0]?.time ?? 0;
      const ballActive = visibleFlights.length > 0;
      this.ballTrail.visible = this.showBallTrail && ballActive;
      if (this.showBallTrail && ballActive) {
        const points: THREE.Vector3[] = [];
        for (let index = 9; index >= 0; index -= 1) {
          const trailPosition = sampleTrajectoryAt(visibleFlights[0]!.trajectory, Math.max(0, cycleTime - index * 0.018), false);
          points.push(new THREE.Vector3(trailPosition.x, trailPosition.y, trailPosition.z));
        }
        this.ballTrail.geometry.dispose();
        this.ballTrail.geometry = new THREE.BufferGeometry().setFromPoints(points);
      }
    } else {
      for (const ball of this.balls) ball.visible = false;
      this.ballTrail.visible = false;
    }
    if (this.cameraMotion) {
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
    this.audience.update(this.elapsed);
    this.renderer.render(this.scene, this.camera);
    this.metricFrames += 1;
    const metricElapsed = now - this.metricStartedAt;
    if (metricElapsed >= 1000) {
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
        venueAsset: this.activeAuthoredArena?.state ?? { status: 'idle', loadedBytes: 0, totalBytes: 0 },
        audience: this.audience.state,
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
          this.renderer.setPixelRatio(this.adaptivePixelRatio);
          this.resize();
          this.slowMetricWindows = 0;
        }
      }
      this.metricFrames = 0;
      this.metricStartedAt = now;
    }
  };

  private resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.applyCamera();
  }

  dispose(): void {
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
