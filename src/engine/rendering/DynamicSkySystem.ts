import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { isOutdoorVenue, type EnvironmentConfiguration, type SceneDefinition } from '../../domain/environment';

const configureSky = (sky: Sky, sunPosition: THREE.Vector3, configuration: EnvironmentConfiguration): void => {
  const weather = configuration.weather;
  const amount = configuration.weatherIntensity;
  const distanceFromSolarNoon = Math.abs(configuration.timeOfDay - 12.75);
  const goldenFactor = THREE.MathUtils.smoothstep(distanceFromSolarNoon, 3.5, 6.2);
  const solarArc = Math.sin(THREE.MathUtils.clamp((configuration.timeOfDay - 5.5) / 15, 0, 1) * Math.PI);
  const noonFactor = THREE.MathUtils.smoothstep(solarArc, 0.68, 0.96);
  const uniforms = sky.material.uniforms;
  uniforms.turbidity!.value = weather === 'clear' ? THREE.MathUtils.lerp(2, 4.4, goldenFactor) : THREE.MathUtils.lerp(7.5, 15, amount);
  uniforms.rayleigh!.value = weather === 'clear' ? THREE.MathUtils.lerp(2.3, 1.3, goldenFactor) : THREE.MathUtils.lerp(1.5, 0.62, amount);
  uniforms.mieCoefficient!.value = weather === 'rain' ? 0.012 : weather === 'overcast' ? 0.008 : THREE.MathUtils.lerp(0.0012, 0.003, goldenFactor);
  uniforms.mieDirectionalG!.value = weather === 'clear' ? THREE.MathUtils.lerp(0.62, 0.72, goldenFactor) : 0.68;
  uniforms.cloudScale!.value = weather === 'clear' ? 0.0042 : 0.0056;
  uniforms.cloudCoverage!.value = weather === 'clear'
    ? 0.46
    : weather === 'rain'
      ? THREE.MathUtils.lerp(0.8, 0.97, amount)
      : THREE.MathUtils.lerp(0.65, 0.86, amount);
  uniforms.cloudDensity!.value = weather === 'clear' ? 0.68 : THREE.MathUtils.lerp(0.72, 0.94, amount);
  uniforms.cloudElevation!.value = weather === 'clear' ? 0.58 : 0.7;
  uniforms.cloudSpeed!.value = 0.0012;
  uniforms.showSunDisc!.value = weather === 'clear' ? THREE.MathUtils.lerp(0.22, 0.025, noonFactor) : 0.008;
  (uniforms.sunPosition!.value as THREE.Vector3).copy(sunPosition);
};

export class DynamicSkySystem {
  readonly sky = new Sky();
  private readonly environmentScene = new THREE.Scene();
  private readonly environmentSky = new Sky();
  private readonly pmrem: THREE.PMREMGenerator;
  private environmentTarget: THREE.WebGLRenderTarget | null = null;
  private dirty = false;
  private changedAt = 0;

  constructor(
    private readonly scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    private readonly sun: THREE.DirectionalLight,
    private readonly hemisphere: THREE.HemisphereLight,
  ) {
    this.sky.name = 'dynamic-physical-sky';
    this.sky.scale.setScalar(380);
    this.sky.visible = false;
    this.environmentSky.scale.setScalar(120);
    this.environmentScene.add(this.environmentSky);
    this.scene.add(this.sky);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileCubemapShader();
  }

  apply(configuration: EnvironmentConfiguration, definition: SceneDefinition): void {
    const outdoor = isOutdoorVenue(configuration.venue);
    this.sky.visible = outdoor;
    this.sun.visible = outdoor;
    this.hemisphere.visible = true;
    if (!outdoor) {
      this.scene.environment = null;
      this.scene.environmentIntensity = 0.42;
      this.scene.background = new THREE.Color(definition.background);
      this.scene.fog = new THREE.Fog(definition.background, definition.fogNear, definition.fogFar);
      this.hemisphere.color.setHex(0xd9e1e4);
      this.hemisphere.groundColor.setHex(0x252b2e);
      this.hemisphere.intensity = 0.72 * configuration.lightIntensity;
      return;
    }

    this.scene.background = null;
    const daylight = Math.sin(THREE.MathUtils.clamp((configuration.timeOfDay - 5.5) / 15, 0, 1) * Math.PI);
    const elevation = THREE.MathUtils.lerp(-4, 67, Math.pow(Math.max(0, daylight), 1.5));
    const azimuth = configuration.lightDirection;
    const sunPosition = new THREE.Vector3().setFromSphericalCoords(
      1,
      THREE.MathUtils.degToRad(90 - elevation),
      THREE.MathUtils.degToRad(azimuth),
    );
    configureSky(this.sky, sunPosition, configuration);
    configureSky(this.environmentSky, sunPosition, configuration);
    this.sun.position.copy(sunPosition).multiplyScalar(70);
    this.sun.target.position.set(0, 0, 0);
    const cloudAttenuation = configuration.weather === 'clear'
      ? 1
      : THREE.MathUtils.lerp(0.78, configuration.weather === 'rain' ? 0.22 : 0.38, configuration.weatherIntensity);
    const sunStrength = Math.max(0.025, Math.pow(Math.max(0, daylight), 0.7)) * cloudAttenuation;
    const warm = new THREE.Color(0xffa45c);
    const neutral = new THREE.Color(0xfff1d0);
    this.sun.color.copy(warm).lerp(neutral, THREE.MathUtils.smoothstep(elevation, 4, 28));
    this.sun.intensity = 2.15 * sunStrength * configuration.lightIntensity;
    this.hemisphere.color.set(configuration.weather === 'clear' ? 0xcfe8ff : 0xaab9c2);
    this.hemisphere.groundColor.set(configuration.weather === 'rain' ? 0x27352d : 0x466044);
    this.hemisphere.intensity = (0.28 + 0.52 * Math.max(0, daylight)) * (configuration.weather === 'clear' ? 1 : 0.72) * configuration.lightIntensity;
    this.scene.environmentIntensity = configuration.weather === 'clear' ? 0.3 : 0.24;
    const fogColor = new THREE.Color(configuration.weather === 'rain' ? 0x71808a : configuration.weather === 'overcast' ? 0xaab8bf : definition.background);
    const fogCompression = configuration.weather === 'clear' ? 1 : THREE.MathUtils.lerp(0.92, 0.55, configuration.weatherIntensity);
    this.scene.fog = new THREE.Fog(fogColor, definition.fogNear * fogCompression, definition.fogFar * fogCompression);
    this.dirty = true;
    this.changedAt = performance.now();
  }

  update(now: number): void {
    this.sky.material.uniforms.time!.value = now * 0.001;
    this.environmentSky.material.uniforms.time!.value = now * 0.001;
    if (!this.dirty || !this.sky.visible || now - this.changedAt < 120) return;
    this.environmentTarget?.dispose();
    this.environmentTarget = this.pmrem.fromScene(this.environmentScene, 0, 0.1, 200);
    this.scene.environment = this.environmentTarget.texture;
    this.dirty = false;
  }

  dispose(): void {
    this.scene.environment = null;
    this.environmentTarget?.dispose();
    this.pmrem.dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.environmentSky.geometry.dispose();
    this.environmentSky.material.dispose();
  }
}
