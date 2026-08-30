import * as THREE from 'three';
import { cameraRotationRadians } from '../../domain/camera';
import { COURT, type SurfaceId } from '../../domain/court';
import { DEFAULT_ENVIRONMENT, SCENE_DEFINITIONS, isOutdoorVenue, windVelocityFromEnvironment, type EnvironmentConfiguration, type VenueId } from '../../domain/environment';
import type { ResolvedTrajectory } from '../trajectory/physics';
import { aimDirectionToCourtPoint, sampleTrajectoryAt } from '../trajectory/physics';
import { createCourt } from './buildCourt';
import { OpponentRig, OpponentRigDisposedError } from './OpponentRig';
import { DynamicSkySystem } from './DynamicSkySystem';
import { WeatherSystem } from './WeatherSystem';
import { updateSceneMaterialEnvironment, type SceneMaterialBundle } from './sceneMaterials';

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
}>;

export type QualityMode = 'auto' | 'performance' | 'quality';

export type CameraMotion = Readonly<{
  from: CameraConfiguration;
  to: CameraConfiguration;
  duration: number;
  delay?: number;
}>;

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
  private readonly camera = new THREE.PerspectiveCamera(54, 16 / 9, 0.05, 140);
  private readonly ball: THREE.Mesh;
  private readonly balls: THREE.Mesh[] = [];
  private readonly ballMaterial: THREE.MeshStandardMaterial;
  private readonly trajectoryLine: THREE.Line;
  private readonly ballTrail: THREE.Line;
  private readonly hemisphere: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly opponent = new OpponentRig();
  private readonly fallbackBallMachine: THREE.Object3D | undefined;
  private readonly venueGroups: Readonly<Record<VenueId, THREE.Group>>;
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
    this.scene.add(this.sun);

    this.scene.add(this.sun.target);
    this.skySystem = new DynamicSkySystem(this.scene, this.renderer, this.sun, this.hemisphere);
    this.weatherSystem = new WeatherSystem(this.scene);

    const court = createCourt('hard');
    this.setCourtSurface = court.setSurface;
    this.materialBundle = court.materialBundle;
    this.venueGroups = court.venueGroups;
    this.scene.add(court.group);
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
      color: 0xe8ef32,
      emissive: 0x697214,
      emissiveIntensity: 0.28,
      roughness: 0.62,
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(COURT.ballRadius * 1.34, 24, 16), this.ballMaterial);
    this.ball.castShadow = true;
    this.balls.push(this.ball);
    this.scene.add(this.ball);

    this.trajectoryLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xf2df21, transparent: true, opacity: 0.56 }),
    );
    this.scene.add(this.trajectoryLine);
    this.ballTrail = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xf5f77b, transparent: true, opacity: 0.52 }),
    );
    this.ballTrail.visible = false;
    this.scene.add(this.ballTrail);

    this.setCamera(this.cameraConfiguration);
    this.setEnvironment(DEFAULT_ENVIRONMENT);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.renderer.setAnimationLoop(this.animate);
  }

  setTrajectory(trajectory: ResolvedTrajectory): void {
    this.trajectory = trajectory;
    this.elapsed = 0;
    this.opponent.group.position.set(trajectory.intent.source.x, 0, trajectory.intent.source.z);
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

  setTrajectoryVisible(visible: boolean): void {
    this.trajectoryLine.visible = visible;
  }

  setBallPresentation(highContrast: boolean, showTrail: boolean): void {
    this.showBallTrail = showTrail;
    this.ballTrail.visible = showTrail;
    for (const ball of this.balls) ball.scale.setScalar(highContrast ? 1.24 : 1);
    this.ballMaterial.color.setHex(highContrast ? 0xf8ff24 : 0xe8ef32);
    this.ballMaterial.emissive.setHex(highContrast ? 0xb0bd1a : 0x697214);
    this.ballMaterial.emissiveIntensity = highContrast ? 0.62 : 0.28;
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
    this.setCourtSurface(surface);
  }

  setEnvironment(configuration: EnvironmentConfiguration): void {
    this.environmentConfiguration = configuration;
    for (const [venue, group] of Object.entries(this.venueGroups)) group.visible = venue === configuration.venue;
    const intensity = Math.min(1.5, Math.max(0.35, configuration.lightIntensity));
    const definition = SCENE_DEFINITIONS[configuration.venue];
    if (isOutdoorVenue(configuration.venue)) {
      const solarDaylight = Math.sin(THREE.MathUtils.clamp((configuration.timeOfDay - 5.5) / 15, 0, 1) * Math.PI);
      const lowLightLift = (1 - solarDaylight) * 0.06;
      const weatherLift = configuration.weather === 'clear' ? 0 : 0.04 * configuration.weatherIntensity;
      this.renderer.toneMappingExposure = (0.52 + lowLightLift + weatherLift) * THREE.MathUtils.lerp(0.9, 1.06, intensity / 1.5);
    } else {
      this.renderer.toneMappingExposure = (configuration.lighting === 'indoor-bright' ? 0.68 : configuration.lighting === 'indoor-warm' ? 0.63 : 0.6)
        * THREE.MathUtils.lerp(0.88, 1.08, intensity / 1.5);
    }
    this.skySystem.apply(configuration, definition);
    this.weatherSystem.apply(configuration);
    const activeVenue = this.venueGroups[configuration.venue];
    const warm = configuration.lighting === 'indoor-warm';
    const solarArc = Math.sin(THREE.MathUtils.clamp((configuration.timeOfDay - 5.5) / 15, 0, 1) * Math.PI);
    const solarElevation = THREE.MathUtils.lerp(-4, 67, Math.pow(Math.max(0, solarArc), 1.5));
    const outdoorFixtureScale = 1 - THREE.MathUtils.smoothstep(solarElevation, -1, 7);
    const fixtureScale = isOutdoorVenue(configuration.venue) ? outdoorFixtureScale : 1;
    activeVenue.traverse((object) => {
      if (!(object instanceof THREE.PointLight || object instanceof THREE.SpotLight)) return;
      const baseIntensity = typeof object.userData.baseIntensity === 'number' ? object.userData.baseIntensity : 35;
      object.intensity = baseIntensity * intensity * fixtureScale;
      object.color.setHex(warm ? 0xffd09a : 0xe7f2ff);
    });
    const wind = windVelocityFromEnvironment(configuration);
    updateSceneMaterialEnvironment(this.materialBundle, this.elapsed, configuration.weather === 'rain' ? configuration.weatherIntensity * 0.86 : 0, wind.x, wind.z);
  }

  setQualityMode(mode: QualityMode): void {
    this.qualityMode = mode;
    this.slowMetricWindows = 0;
    this.adaptivePixelRatio = mode === 'performance'
      ? Math.min(window.devicePixelRatio, 1)
      : mode === 'quality'
        ? Math.min(window.devicePixelRatio, 1.75)
        : Math.min(window.devicePixelRatio, 1.5);
    this.renderer.setPixelRatio(this.adaptivePixelRatio);
    this.resize();
  }

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
    if (this.running) this.elapsed += delta * this.playbackRate;
    this.opponent.update(this.running ? delta * this.playbackRate : 0);
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
      const sampleTimes = trajectoryPlaybackTimes(this.elapsed, duration, this.loopTrajectory, this.trajectoryInterval);
      this.ensureBallCount(Math.max(1, sampleTimes.length));
      for (let index = 0; index < this.balls.length; index += 1) {
        const ball = this.balls[index]!;
        const sampleTime = sampleTimes[index];
        ball.visible = sampleTime !== undefined;
        if (sampleTime === undefined) continue;
        const position = sampleTrajectoryAt(
          this.trajectory,
          sampleTime,
          this.loopTrajectory && this.trajectoryInterval === null,
        );
        ball.position.set(position.x, position.y, position.z);
      }
      const cycleTime = sampleTimes[0] ?? 0;
      const ballActive = sampleTimes.length > 0;
      this.ballTrail.visible = this.showBallTrail && ballActive;
      if (this.showBallTrail && ballActive) {
        const points: THREE.Vector3[] = [];
        for (let index = 9; index >= 0; index -= 1) {
          const trailPosition = sampleTrajectoryAt(this.trajectory, Math.max(0, cycleTime - index * 0.018), false);
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
      const raw = Math.min(1, Math.max(0, (this.elapsed - delay) / Math.max(0.001, this.cameraMotion.duration)));
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
    this.renderer.render(this.scene, this.camera);
    this.metricFrames += 1;
    const metricElapsed = now - this.metricStartedAt;
    if (metricElapsed >= 1000) {
      this.onMetrics?.({
        fps: Math.round((this.metricFrames * 1000) / metricElapsed),
        frameMs: metricElapsed / this.metricFrames,
        pixelRatio: this.renderer.getPixelRatio(),
        renderer: this.renderer.capabilities.isWebGL2 ? 'WebGL 2' : 'WebGL 1',
        quality: this.qualityMode,
      });
      const fps = (this.metricFrames * 1000) / metricElapsed;
      if (this.qualityMode === 'auto') {
        this.slowMetricWindows = fps < 52 ? this.slowMetricWindows + 1 : Math.max(0, this.slowMetricWindows - 1);
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
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
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
