import * as THREE from 'three';
import { COURT, type SurfaceId } from '../../domain/court';
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
}>;

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
  private readonly trajectoryLine: THREE.Line;
  private readonly resizeObserver: ResizeObserver;
  private courtMaterial: THREE.MeshStandardMaterial;
  private trajectory: ResolvedTrajectory | null = null;
  private elapsed = 0;
  private running = true;
  private playbackRate = 1;
  private loopTrajectory = true;
  private cameraMotion: CameraMotion | null = null;
  private lastFrame = performance.now();
  private metricStartedAt = performance.now();
  private metricFrames = 0;
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

    this.scene.background = new THREE.Color(0x8fc5eb);
    this.scene.fog = new THREE.Fog(0x8fc5eb, 47, 105);

    const hemisphere = new THREE.HemisphereLight(0xd9efff, 0x426342, 2.1);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(0xfff5d7, 4.25);
    sun.position.set(-12, 22, -11);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -19;
    sun.shadow.camera.right = 19;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -20;
    this.scene.add(sun);

    const court = createCourt('hard');
    this.courtMaterial = court.courtMaterial;
    this.scene.add(court.group);

    const ballMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8ef32,
      emissive: 0x697214,
      emissiveIntensity: 0.28,
      roughness: 0.62,
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(COURT.ballRadius * 1.34, 24, 16), ballMaterial);
    this.ball.castShadow = true;
    this.scene.add(this.ball);

    this.trajectoryLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xf2df21, transparent: true, opacity: 0.56 }),
    );
    this.scene.add(this.trajectoryLine);

    this.setCamera(this.cameraConfiguration);
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
      });
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
