import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { isOutdoorVenue, type EnvironmentConfiguration, type SceneDefinition } from '../../domain/environment';
import { resolveVenueLighting } from './venueLighting';

const configureSky = (sky: Sky, sunPosition: THREE.Vector3, configuration: EnvironmentConfiguration): void => {
  const weather = configuration.weather;
  const amount = configuration.weatherIntensity;
  const state = resolveVenueLighting(configuration);
  const goldenFactor = state.golden;
  const solarArc = state.arc;
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
  uniforms.venueGolden!.value = goldenFactor * (weather === 'clear' ? 1 : 1 - amount);
};

const addTwilightColor = (sky: Sky): void => {
  sky.material.uniforms.venueGolden = { value: 0 };
  sky.material.fragmentShader = 'uniform float venueGolden;\n' + sky.material.fragmentShader.replace(
    'gl_FragColor = vec4( texColor, 1.0 );',
    `// Warm clouds and the horizon without replacing the physical sky with a gradient.
    float warmth = venueGolden * mix(0.86, 0.64, smoothstep(0.0, 0.9, direction.y));
    float skyLuminance = dot(texColor, vec3(0.2126, 0.7152, 0.0722));
    vec3 duskColor = mix(vec3(0.50, 0.25, 0.19), vec3(1.55, 0.80, 0.30), smoothstep(0.0, 1.4, skyLuminance));
    texColor = mix(texColor, duskColor * (0.3 + skyLuminance), warmth);
    gl_FragColor = vec4(texColor, 1.0);`,
  );
};

export class DynamicSkySystem {
  readonly sky = new Sky();
  private readonly environmentScene = new THREE.Scene();
  private readonly environmentSky = new Sky();
  private readonly pmrem: THREE.PMREMGenerator;
  private environmentTarget: THREE.WebGLRenderTarget | null = null;
  private indoorEnvironment: THREE.WebGLRenderTarget | null = null;
  private dirty = false;
  private changedAt = 0;

  constructor(
    private readonly scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    private readonly sun: THREE.DirectionalLight,
    private readonly hemisphere: THREE.HemisphereLight,
  ) {
    addTwilightColor(this.sky);
    addTwilightColor(this.environmentSky);
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
    const state = resolveVenueLighting(configuration);
    const outdoor = isOutdoorVenue(configuration.venue);
    this.sky.visible = outdoor;
    this.sun.visible = outdoor;
    this.hemisphere.visible = true;
    if (!outdoor) {
      // One shared prefiltered bounce-light environment, generated on first hall
      // visit only. It lights the roof underside without extra per-frame lights.
      if (!this.indoorEnvironment) {
        const room = new RoomEnvironment();
        this.indoorEnvironment = this.pmrem.fromScene(room, .08);
        room.dispose();
      }
      this.scene.environment = this.indoorEnvironment.texture;
      this.scene.environmentIntensity = .35 * configuration.lightIntensity;
      this.scene.background = new THREE.Color(definition.background);
      this.scene.fog = new THREE.Fog(definition.background, definition.fogNear, definition.fogFar);
      this.hemisphere.color.setHex(0xd9e1e4);
      this.hemisphere.groundColor.setHex(0x252b2e);
      this.hemisphere.intensity = state.hemisphereIntensity;
      return;
    }

    this.scene.background = null;
    const elevation = state.elevation;
    const azimuth = configuration.lightDirection;
    const sunPosition = new THREE.Vector3().setFromSphericalCoords(
      1,
      THREE.MathUtils.degToRad(90 - elevation),
      THREE.MathUtils.degToRad(azimuth),
    );
    configureSky(this.sky, sunPosition, configuration);
    configureSky(this.environmentSky, sunPosition, configuration);
    // Keep the complete stadium in front of the shadow camera at low angles.
    this.sun.position.copy(sunPosition).multiplyScalar(150);
    this.sun.target.position.set(0, 0, 0);
    const warm = new THREE.Color(0xffa45c);
    const neutral = new THREE.Color(0xfff1d0);
    this.sun.color.copy(neutral).lerp(warm, state.golden * .8);
    this.sun.intensity = state.sunIntensity;
    this.hemisphere.color.set(configuration.weather === 'clear' ? 0xcfe8ff : 0xaab9c2);
    this.hemisphere.groundColor.set(configuration.weather === 'rain' ? 0x27352d : 0x466044);
    this.hemisphere.intensity = state.hemisphereIntensity;
    this.scene.environmentIntensity = state.environmentIntensity;
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
    this.indoorEnvironment?.dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.environmentSky.geometry.dispose();
    this.environmentSky.material.dispose();
  }
}
