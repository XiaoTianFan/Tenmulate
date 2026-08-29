import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { isOutdoorVenue, type EnvironmentConfiguration, type SceneDefinition } from '../../domain/environment';

const configureSky = (sky: Sky, sunPosition: THREE.Vector3, configuration: EnvironmentConfiguration): void => {
  const weather = configuration.weather;
  const amount = configuration.weatherIntensity;
  const distanceFromSolarNoon = Math.abs(configuration.timeOfDay - 12.75);
  const goldenFactor = THREE.MathUtils.smoothstep(distanceFromSolarNoon, 3.5, 6.2);
  const uniforms = sky.material.uniforms;
  uniforms.turbidity!.value = weather === 'clear' ? THREE.MathUtils.lerp(2.4, 8.6, goldenFactor) : THREE.MathUtils.lerp(9, 19, amount);
  uniforms.rayleigh!.value = weather === 'clear' ? THREE.MathUtils.lerp(1.65, 0.78, goldenFactor) : THREE.MathUtils.lerp(1.45, 0.45, amount);
  uniforms.mieCoefficient!.value = weather === 'rain' ? 0.028 : weather === 'overcast' ? 0.014 : THREE.MathUtils.lerp(0.006, 0.019, goldenFactor);
  uniforms.mieDirectionalG!.value = weather === 'clear' ? THREE.MathUtils.lerp(0.82, 0.91, goldenFactor) : 0.72;
  (uniforms.sunPosition!.value as THREE.Vector3).copy(sunPosition);
};

const createCloudDome = (): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> => {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    uniforms: {
      time: { value: 0 },
      coverage: { value: 0.38 },
      density: { value: 0.5 },
      opacity: { value: 0.72 },
      wind: { value: new THREE.Vector2(0.018, 0.006) },
      lightColor: { value: new THREE.Color(0xf5f6f2) },
      shadowColor: { value: new THREE.Color(0x9ca8b0) },
      horizonTint: { value: new THREE.Color(0xffbd8a) },
      daylight: { value: 1 },
    },
    vertexShader: `
      varying vec3 vCloudDirection;
      void main() {
        vCloudDirection = normalize(position);
        vec4 projected = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = projected.xyww;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float coverage;
      uniform float density;
      uniform float opacity;
      uniform vec2 wind;
      uniform vec3 lightColor;
      uniform vec3 shadowColor;
      uniform vec3 horizonTint;
      uniform float daylight;
      varying vec3 vCloudDirection;

      float hash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.54;
        for (int i = 0; i < 6; i++) {
          value += noise(p) * amplitude;
          p = p * 2.02 + vec2(3.1, 1.7);
          amplitude *= 0.5;
        }
        return value;
      }
      void main() {
        vec3 direction = normalize(vCloudDirection);
        float longitude = atan(direction.z, direction.x) / 6.2831853 + 0.5;
        float latitude = asin(clamp(direction.y, -1.0, 1.0)) / 3.1415926 + 0.5;
        vec2 cloudUv = vec2(longitude * 5.2, latitude * 8.4) + time * wind;
        float broad = fbm(cloudUv);
        float detail = fbm(cloudUv * 2.35 + vec2(7.4, 3.8));
        float cloudField = broad * 0.76 + detail * 0.24;
        float threshold = mix(0.79, 0.34, coverage);
        float cloud = smoothstep(threshold, threshold + mix(0.2, 0.07, density), cloudField);
        float horizonMask = smoothstep(-0.035, 0.09, direction.y);
        float zenithMask = 1.0 - smoothstep(0.82, 0.985, direction.y);
        float brokenEdge = smoothstep(0.2, 0.78, detail);
        float alpha = cloud * horizonMask * zenithMask * opacity * mix(0.72, 1.0, brokenEdge);
        float warmBand = (1.0 - smoothstep(0.08, 0.42, direction.y)) * (1.0 - daylight);
        vec3 cloudColor = mix(shadowColor, lightColor, smoothstep(0.34, 0.86, cloudField));
        cloudColor = mix(cloudColor, horizonTint, warmBand * 0.62);
        gl_FragColor = vec4(cloudColor, alpha);
      }
    `,
  });
  const cloudDome = new THREE.Mesh(new THREE.SphereGeometry(360, 48, 28), material);
  cloudDome.name = 'procedural-responsive-cloud-dome';
  cloudDome.renderOrder = 1;
  cloudDome.frustumCulled = false;
  cloudDome.visible = false;
  return cloudDome;
};

export class DynamicSkySystem {
  readonly sky = new Sky();
  readonly clouds = createCloudDome();
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
    this.scene.add(this.clouds);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileCubemapShader();
  }

  apply(configuration: EnvironmentConfiguration, definition: SceneDefinition): void {
    const outdoor = isOutdoorVenue(configuration.venue);
    this.sky.visible = outdoor;
    this.clouds.visible = outdoor;
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
    const cloudUniforms = this.clouds.material.uniforms;
    const weatherAmount = configuration.weatherIntensity;
    cloudUniforms.coverage!.value = configuration.weather === 'clear' ? 0.32 : configuration.weather === 'rain' ? THREE.MathUtils.lerp(0.72, 0.96, weatherAmount) : THREE.MathUtils.lerp(0.58, 0.88, weatherAmount);
    cloudUniforms.density!.value = configuration.weather === 'clear' ? 0.42 : THREE.MathUtils.lerp(0.62, 0.94, weatherAmount);
    cloudUniforms.opacity!.value = configuration.weather === 'clear' ? 0.66 : THREE.MathUtils.lerp(0.78, 0.98, weatherAmount);
    (cloudUniforms.wind!.value as THREE.Vector2).set(
      0.012 + Math.sin(THREE.MathUtils.degToRad(configuration.windDirection)) * configuration.windSpeedMps * 0.0015,
      0.004 + Math.cos(THREE.MathUtils.degToRad(configuration.windDirection)) * configuration.windSpeedMps * 0.001,
    );
    const duskFactor = 1 - THREE.MathUtils.smoothstep(elevation, 6, 28);
    const nightFactor = 1 - THREE.MathUtils.smoothstep(elevation, -2, 8);
    (cloudUniforms.lightColor!.value as THREE.Color).set(configuration.weather === 'clear' ? 0xf5f7f6 : 0xd2d9dc).lerp(new THREE.Color(0x88939c), nightFactor * 0.7);
    (cloudUniforms.shadowColor!.value as THREE.Color).set(configuration.weather === 'rain' ? 0x53616b : 0x95a3ad).lerp(new THREE.Color(0x263544), nightFactor * 0.72);
    (cloudUniforms.horizonTint!.value as THREE.Color).set(configuration.weather === 'rain' ? 0x89939a : 0xffa46d);
    cloudUniforms.daylight!.value = 1 - duskFactor;
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
    this.clouds.material.uniforms.time!.value = now * 0.00004;
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
    this.clouds.geometry.dispose();
    this.clouds.material.dispose();
  }
}
