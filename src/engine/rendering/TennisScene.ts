import * as THREE from 'three';
import { COURT, type SurfaceId } from '../../domain/court';
import { DEFAULT_ENVIRONMENT, type EnvironmentConfiguration, type VenueId } from '../../domain/environment';
import type { ResolvedTrajectory } from '../trajectory/physics';
import { sampleTrajectoryAt } from '../trajectory/physics';
import { createCourt } from './buildCourt';

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

export class TennisScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(54, 16 / 9, 0.05, 140);
  private readonly ball: THREE.Mesh;
  private readonly ballMaterial: THREE.MeshStandardMaterial;
  private readonly trajectoryLine: THREE.Line;
  private readonly ballTrail: THREE.Line;
  private readonly hemisphere: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly floodlights = new THREE.Group();
  private readonly venueGroups: Readonly<Record<VenueId, THREE.Group>>;
  private readonly resizeObserver: ResizeObserver;
  private courtMaterial: THREE.MeshStandardMaterial;
  private trajectory: ResolvedTrajectory | null = null;
  private elapsed = 0;
  private running = true;
  private playbackRate = 1;
  private loopTrajectory = true;
  private showBallTrail = false;
  private cameraMotion: CameraMotion | null = null;
  private lastFrame = performance.now();
  private metricStartedAt = performance.now();
  private metricFrames = 0;
  private qualityMode: QualityMode = 'auto';
  private adaptivePixelRatio = Math.min(window.devicePixelRatio, 1.75);
  private slowMetricWindows = 0;
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
    this.renderer.toneMappingExposure = 1.05;
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

    for (const x of [-8.5, 8.5]) {
      for (const z of [-9, 9]) {
        const light = new THREE.PointLight(0xeaf2ff, 0, 35, 1.45);
        light.position.set(x, 8, z);
        this.floodlights.add(light);
      }
    }
    this.scene.add(this.floodlights);

    const court = createCourt('hard');
    this.courtMaterial = court.courtMaterial;
    this.venueGroups = court.venueGroups;
    this.scene.add(court.group);

    this.ballMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8ef32,
      emissive: 0x697214,
      emissiveIntensity: 0.28,
      roughness: 0.62,
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(COURT.ballRadius * 1.34, 24, 16), this.ballMaterial);
    this.ball.castShadow = true;
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
    this.ball.scale.setScalar(highContrast ? 1.24 : 1);
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

  setCameraMotion(motion: CameraMotion | null): void {
    this.cameraMotion = motion;
  }

  setSurface(surface: SurfaceId): void {
    const colors: Record<SurfaceId, number> = { hard: 0x2f6c9b, clay: 0xa9532d, grass: 0x4c793d };
    this.courtMaterial.color.setHex(colors[surface]);
  }

  setEnvironment(configuration: EnvironmentConfiguration): void {
    for (const [venue, group] of Object.entries(this.venueGroups)) group.visible = venue === configuration.venue;
    const angle = THREE.MathUtils.degToRad(configuration.lightDirection);
    this.sun.position.set(Math.sin(angle) * 18, 22, Math.cos(angle) * 18);
    const intensity = Math.min(1.5, Math.max(0.35, configuration.lightIntensity));
    const indoor = configuration.venue !== 'outdoor';
    const preset = configuration.lighting;
    const isNight = preset === 'night';
    const isGolden = preset === 'golden-hour';
    const isWarm = preset === 'indoor-warm';
    const isBright = preset === 'indoor-bright';
    const background = isNight ? 0x07121d : indoor ? 0x30383d : isGolden ? 0xd58d55 : 0x8fc5eb;
    this.scene.background = new THREE.Color(background);
    this.scene.fog = new THREE.Fog(background, indoor ? 44 : 47, indoor ? 88 : 105);
    this.sun.color.setHex(isNight ? 0xb8d7ff : isGolden || isWarm ? 0xffc987 : 0xfff5d7);
    this.sun.intensity = (isNight ? 0.25 : indoor ? 0.6 : isGolden ? 2.8 : 4.25) * intensity;
    this.hemisphere.color.setHex(isNight ? 0x42658a : indoor ? 0xe8ecef : 0xd9efff);
    this.hemisphere.groundColor.setHex(indoor ? 0x2b3032 : 0x426342);
    this.hemisphere.intensity = (isNight ? 0.48 : indoor ? 1.15 : 2.1) * intensity;
    const floodIntensity = isNight ? 24 : indoor ? (isBright ? 17 : isWarm ? 12 : 14) : 0;
    for (const child of this.floodlights.children) {
      if (child instanceof THREE.PointLight) {
        child.intensity = floodIntensity * intensity;
        child.color.setHex(isWarm ? 0xffd6a3 : 0xeaf2ff);
      }
    }
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
    const yawOffset = Math.tan(THREE.MathUtils.degToRad(configuration.yaw)) * 12;
    const lookY = 1.05 + Math.tan(THREE.MathUtils.degToRad(configuration.pitch)) * 12;
    this.camera.lookAt(yawOffset, lookY, 0);
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
    if (this.trajectory) {
      const position = sampleTrajectoryAt(this.trajectory, this.elapsed, this.loopTrajectory);
      this.ball.position.set(position.x, position.y, position.z);
      if (this.showBallTrail) {
        const points: THREE.Vector3[] = [];
        for (let index = 9; index >= 0; index -= 1) {
          const trailPosition = sampleTrajectoryAt(this.trajectory, Math.max(0, this.elapsed - index * 0.018), this.loopTrajectory);
          points.push(new THREE.Vector3(trailPosition.x, trailPosition.y, trailPosition.z));
        }
        this.ballTrail.geometry.dispose();
        this.ballTrail.geometry = new THREE.BufferGeometry().setFromPoints(points);
      }
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
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      }
    });
    this.renderer.dispose();
  }
}
