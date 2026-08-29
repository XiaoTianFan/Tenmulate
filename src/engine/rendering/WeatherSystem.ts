import * as THREE from 'three';
import { isOutdoorVenue, windVelocityFromEnvironment, type EnvironmentConfiguration } from '../../domain/environment';

export class WeatherSystem {
  readonly rain: THREE.LineSegments;
  private readonly material: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    const count = 850;
    const positions = new Float32Array(count * 2 * 3);
    const tips = new Float32Array(count * 2);
    let state = 0x51f15e;
    const random = () => {
      state = Math.imul(state ^ (state >>> 15), 1 | state);
      state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
      return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
    };
    for (let index = 0; index < count; index += 1) {
      const x = (random() - 0.5) * 54;
      const y = random() * 22;
      const z = (random() - 0.5) * 58;
      const offset = index * 6;
      positions.set([x, y, z, x, y - (0.42 + random() * 0.65), z], offset);
      tips[index * 2] = 0;
      tips[index * 2 + 1] = 1;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('rainTip', new THREE.BufferAttribute(tips, 1));
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0 },
        wind: { value: new THREE.Vector2() },
      },
      vertexShader: `
        uniform float time;
        uniform float intensity;
        uniform vec2 wind;
        attribute float rainTip;
        varying float vRainAlpha;
        void main() {
          vec3 p = position;
          p.y = mod(p.y - time * (11.0 + intensity * 12.0) + 22.0, 22.0);
          p.x = mod(p.x + time * wind.x * 0.55 + 27.0, 54.0) - 27.0;
          p.z = mod(p.z + time * wind.y * 0.55 + 29.0, 58.0) - 29.0;
          p.xz -= wind * rainTip * 0.055;
          vRainAlpha = mix(0.22, 0.68, intensity);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `varying float vRainAlpha; void main() { gl_FragColor = vec4(0.72, 0.84, 0.92, vRainAlpha); }`,
    });
    this.rain = new THREE.LineSegments(geometry, this.material);
    this.rain.name = 'procedural-wind-driven-rain';
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
  }

  apply(configuration: EnvironmentConfiguration): void {
    this.rain.visible = isOutdoorVenue(configuration.venue) && configuration.weather === 'rain' && configuration.weatherIntensity > 0;
    this.material.uniforms.intensity!.value = configuration.weatherIntensity;
    const wind = windVelocityFromEnvironment(configuration);
    (this.material.uniforms.wind!.value as THREE.Vector2).set(wind.x, wind.z);
  }

  update(elapsed: number): void {
    this.material.uniforms.time!.value = elapsed;
  }

  dispose(): void {
    this.rain.geometry.dispose();
    this.material.dispose();
  }
}
