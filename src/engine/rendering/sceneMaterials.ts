import * as THREE from 'three';
import type { SurfaceId } from '../../domain/court';

type ProceduralUniforms = Readonly<{
  colorA: { value: THREE.Color };
  colorB: { value: THREE.Color };
  scale: { value: number };
  pattern: { value: number };
  wetness: { value: number };
  time: { value: number };
  wind: { value: THREE.Vector2 };
  sway: { value: number };
}>;

export type ProceduralMaterial = THREE.MeshPhysicalMaterial & {
  userData: { proceduralUniforms?: ProceduralUniforms } & Record<string, unknown>;
};

export type SceneMaterialLibrary = Readonly<{
  court: ProceduralMaterial;
  runoff: ProceduralMaterial;
  line: ProceduralMaterial;
  darkMetal: ProceduralMaterial;
  lightMetal: ProceduralMaterial;
  blueSeat: ProceduralMaterial;
  greenSeat: ProceduralMaterial;
  warmSeat: ProceduralMaterial;
  paleSeat: ProceduralMaterial;
  concrete: ProceduralMaterial;
  paleConcrete: ProceduralMaterial;
  glass: ProceduralMaterial;
  fence: THREE.ShaderMaterial;
  fencePost: ProceduralMaterial;
  timber: ProceduralMaterial;
  warmWall: ProceduralMaterial;
  roof: ProceduralMaterial;
  clayStone: ProceduralMaterial;
  terracotta: ProceduralMaterial;
  grass: ProceduralMaterial;
  hedge: ProceduralMaterial;
  foliage: readonly ProceduralMaterial[];
  trunk: ProceduralMaterial;
  lamp: ProceduralMaterial;
  darkWall: ProceduralMaterial;
  ceiling: ProceduralMaterial;
  adBoard: ProceduralMaterial;
}>;

export type SceneMaterialBundle = Readonly<{
  materials: SceneMaterialLibrary;
  textures: readonly THREE.Texture[];
}>;

type ProceduralOptions = Readonly<{
  colorA: number;
  colorB: number;
  pattern: number;
  scale?: number;
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  transmission?: number;
  opacity?: number;
  transparent?: boolean;
  sway?: number;
  side?: THREE.Side;
}>;

const createProceduralMaterial = (options: ProceduralOptions): ProceduralMaterial => {
  const uniforms: ProceduralUniforms = {
    colorA: { value: new THREE.Color(options.colorA) },
    colorB: { value: new THREE.Color(options.colorB) },
    scale: { value: options.scale ?? 8 },
    pattern: { value: options.pattern },
    wetness: { value: 0 },
    time: { value: 0 },
    wind: { value: new THREE.Vector2() },
    sway: { value: options.sway ?? 0 },
  };
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: options.roughness ?? 0.78,
    metalness: options.metalness ?? 0,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transmission: options.transmission ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
  }) as ProceduralMaterial;
  material.name = `procedural-pbr-${options.pattern}`;
  material.userData.proceduralUniforms = uniforms;
  material.customProgramCacheKey = () => 'tenmulate-procedural-pbr-v2';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uProcColorA: uniforms.colorA,
      uProcColorB: uniforms.colorB,
      uProcScale: uniforms.scale,
      uProcPattern: uniforms.pattern,
      uWetness: uniforms.wetness,
      uProcTime: uniforms.time,
      uWind: uniforms.wind,
      uSway: uniforms.sway,
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uProcTime;
        uniform vec2 uWind;
        uniform float uSway;
        varying vec3 vProcPosition;
        varying vec2 vProcUv;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float procHeightMask = smoothstep(0.0, 2.2, position.y);
        float procGust = sin(uProcTime * 1.7 + position.y * 2.4 + position.x * 0.7 + position.z * 0.4);
        transformed.xz += uWind * procGust * uSway * procHeightMask * 0.018;
        vProcPosition = position;
        vProcUv = uv;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uProcColorA;
        uniform vec3 uProcColorB;
        uniform float uProcScale;
        uniform float uProcPattern;
        uniform float uWetness;
        varying vec3 vProcPosition;
        varying vec2 vProcUv;
        float procHash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float procNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(procHash(i), procHash(i + vec2(1.0, 0.0)), f.x), mix(procHash(i + vec2(0.0, 1.0)), procHash(i + vec2(1.0)), f.x), f.y);
        }
        float procFbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.52;
          for (int i = 0; i < 4; i++) {
            value += procNoise(p) * amplitude;
            p = p * 2.03 + vec2(1.7, 2.4);
            amplitude *= 0.5;
          }
          return value;
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 procUv = vProcUv * uProcScale;
        float procGrain = procFbm(procUv * 1.35);
        float procDetail = procNoise(procUv * 10.0);
        float procMix = clamp(procGrain * 0.72 + procDetail * 0.18, 0.0, 1.0);
        if (uProcPattern > 0.5 && uProcPattern < 1.5) {
          procMix = clamp(procMix * 0.78 + abs(sin(procUv.y * 4.0 + procNoise(procUv) * 2.0)) * 0.18, 0.0, 1.0);
        } else if (uProcPattern > 1.5 && uProcPattern < 2.5) {
          float stripe = step(0.5, fract(procUv.x * 0.25));
          procMix = mix(procMix * 0.72, 0.88, stripe * 0.52);
        } else if (uProcPattern > 2.5 && uProcPattern < 3.5) {
          vec2 cells = abs(fract(procUv * vec2(0.28, 0.2)) - 0.5);
          float joint = smoothstep(0.47, 0.5, max(cells.x, cells.y));
          procMix = mix(procMix * 0.78, 0.18, joint);
        } else if (uProcPattern > 3.5 && uProcPattern < 4.5) {
          procMix = 0.34 + procNoise(vec2(procUv.x * 5.0, procUv.y * 0.35)) * 0.34;
        } else if (uProcPattern > 4.5 && uProcPattern < 5.5) {
          procMix = procGrain * 0.55 + smoothstep(0.58, 0.9, procDetail) * 0.25;
        } else if (uProcPattern > 5.5 && uProcPattern < 6.5) {
          float grain = sin((procUv.y + procNoise(procUv * vec2(0.35, 2.0))) * 8.0) * 0.5 + 0.5;
          procMix = grain * 0.72 + procGrain * 0.2;
        } else if (uProcPattern > 6.5 && uProcPattern < 7.5) {
          float seam = smoothstep(0.46, 0.5, abs(fract(procUv.x * 0.22) - 0.5));
          procMix = mix(procMix * 0.7, 0.2, seam);
        } else if (uProcPattern > 7.5 && uProcPattern < 8.5) {
          procMix = clamp(procFbm(procUv * 0.52) * 0.9 + procDetail * 0.1, 0.0, 1.0);
        } else if (uProcPattern > 8.5) {
          float diagonal = smoothstep(0.42, 0.5, abs(fract((procUv.x + procUv.y) * 0.35) - 0.5));
          procMix = mix(procMix * 0.45, 0.92, diagonal);
        }
        vec3 proceduralColor = mix(uProcColorA, uProcColorB, procMix);
        proceduralColor *= 1.0 - uWetness * 0.12;
        diffuseColor.rgb *= proceduralColor;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.2, uWetness * 0.58);`);
  };
  return material;
};

const createFenceMaterial = (): THREE.ShaderMaterial => new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: { color: { value: new THREE.Color(0x4f6b60) }, opacity: { value: 0.32 } },
  vertexShader: `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 color; uniform float opacity; void main() { gl_FragColor = vec4(color, opacity); }`,
});

const surfaceStyle = (surface: SurfaceId) => {
  if (surface === 'clay') return { colorA: 0x9e492a, colorB: 0xcf7847, pattern: 1, scale: 9, roughness: 0.95 } as const;
  if (surface === 'grass') return { colorA: 0x285b31, colorB: 0x65914b, pattern: 2, scale: 8, roughness: 0.96 } as const;
  return { colorA: 0x225f91, colorB: 0x58a0c9, pattern: 0, scale: 10, roughness: 0.78 } as const;
};

export const createSceneMaterialBundle = (surface: SurfaceId): SceneMaterialBundle => {
  const court = createProceduralMaterial(surfaceStyle(surface));
  const materials: SceneMaterialLibrary = {
    court,
    runoff: createProceduralMaterial({ colorA: 0x285943, colorB: 0x78a26b, pattern: 0, scale: 9, roughness: 0.92 }),
    line: createProceduralMaterial({ colorA: 0xe9e7dc, colorB: 0xffffff, pattern: 0, scale: 14, roughness: 0.76 }),
    darkMetal: createProceduralMaterial({ colorA: 0x10171b, colorB: 0x35434a, pattern: 4, scale: 12, roughness: 0.38, metalness: 0.72 }),
    lightMetal: createProceduralMaterial({ colorA: 0x65747b, colorB: 0xa7b5ba, pattern: 4, scale: 14, roughness: 0.34, metalness: 0.78 }),
    blueSeat: createProceduralMaterial({ colorA: 0x075d9a, colorB: 0x2694ce, pattern: 5, scale: 9, roughness: 0.5, emissive: 0x062337, emissiveIntensity: 0.24 }),
    greenSeat: createProceduralMaterial({ colorA: 0x0c4936, colorB: 0x268365, pattern: 5, scale: 9, roughness: 0.56, emissive: 0x041710, emissiveIntensity: 0.2 }),
    warmSeat: createProceduralMaterial({ colorA: 0x76503c, colorB: 0xc4a477, pattern: 5, scale: 9, roughness: 0.68 }),
    paleSeat: createProceduralMaterial({ colorA: 0xbfc8c5, colorB: 0xe6ebe8, pattern: 5, scale: 9, roughness: 0.68 }),
    concrete: createProceduralMaterial({ colorA: 0x8c8f8d, colorB: 0xc7c9c4, pattern: 3, scale: 7, roughness: 0.9 }),
    paleConcrete: createProceduralMaterial({ colorA: 0xc8c6ba, colorB: 0xe7e4d7, pattern: 3, scale: 7, roughness: 0.88 }),
    glass: createProceduralMaterial({ colorA: 0x7297a7, colorB: 0xb9d4dd, pattern: 4, scale: 18, roughness: 0.1, metalness: 0.04, transmission: 0.1, transparent: true, opacity: 0.58, side: THREE.DoubleSide }),
    fence: createFenceMaterial(),
    fencePost: createProceduralMaterial({ colorA: 0x263c35, colorB: 0x587268, pattern: 4, scale: 12, roughness: 0.45, metalness: 0.64 }),
    timber: createProceduralMaterial({ colorA: 0x5d351f, colorB: 0xb07a4d, pattern: 6, scale: 3, roughness: 0.72 }),
    warmWall: createProceduralMaterial({ colorA: 0xc6c0ac, colorB: 0xf0ead8, pattern: 3, scale: 6, roughness: 0.86 }),
    roof: createProceduralMaterial({ colorA: 0x59666c, colorB: 0x9ba8ad, pattern: 7, scale: 9, roughness: 0.55, metalness: 0.4 }),
    clayStone: createProceduralMaterial({ colorA: 0x9d7955, colorB: 0xd6ba8a, pattern: 3, scale: 6, roughness: 0.94 }),
    terracotta: createProceduralMaterial({ colorA: 0x86371f, colorB: 0xc66e3d, pattern: 7, scale: 8, roughness: 0.88 }),
    grass: createProceduralMaterial({ colorA: 0x204d30, colorB: 0x568250, pattern: 2, scale: 7, roughness: 0.96, sway: 0.08 }),
    hedge: createProceduralMaterial({ colorA: 0x183f29, colorB: 0x42724a, pattern: 8, scale: 6, roughness: 0.96, sway: 0.12 }),
    foliage: [
      createProceduralMaterial({ colorA: 0x164a2d, colorB: 0x4f8451, pattern: 8, scale: 5, roughness: 0.96, sway: 0.75 }),
      createProceduralMaterial({ colorA: 0x245f36, colorB: 0x6a9955, pattern: 8, scale: 5, roughness: 0.94, sway: 0.7 }),
      createProceduralMaterial({ colorA: 0x103a2a, colorB: 0x3d7048, pattern: 8, scale: 5, roughness: 0.98, sway: 0.8 }),
    ],
    trunk: createProceduralMaterial({ colorA: 0x3f2b1c, colorB: 0x755943, pattern: 6, scale: 4, roughness: 0.98 }),
    lamp: createProceduralMaterial({ colorA: 0xdfe6e4, colorB: 0xffffff, pattern: 4, scale: 16, roughness: 0.22, emissive: 0xddeaff, emissiveIntensity: 3.2 }),
    darkWall: createProceduralMaterial({ colorA: 0x161d20, colorB: 0x384247, pattern: 3, scale: 6, roughness: 0.82 }),
    ceiling: createProceduralMaterial({ colorA: 0xbec8c6, colorB: 0xe5ebe9, pattern: 7, scale: 8, roughness: 0.76 }),
    adBoard: createProceduralMaterial({ colorA: 0x11171a, colorB: 0x2a3438, pattern: 9, scale: 8, roughness: 0.55, emissive: 0x071015, emissiveIntensity: 0.22 }),
  };
  return { textures: [], materials };
};

export const applyCourtSurface = (bundle: SceneMaterialBundle, surface: SurfaceId): void => {
  const courtUniforms = bundle.materials.court.userData.proceduralUniforms;
  const runoffUniforms = bundle.materials.runoff.userData.proceduralUniforms;
  if (!courtUniforms || !runoffUniforms) return;
  const style = surfaceStyle(surface);
  courtUniforms.colorA.value.setHex(style.colorA);
  courtUniforms.colorB.value.setHex(style.colorB);
  courtUniforms.pattern.value = style.pattern;
  courtUniforms.scale.value = style.scale;
  bundle.materials.court.roughness = style.roughness;
  const runoffStyle = surface === 'clay'
    ? { a: 0x8f4127, b: 0xc26a3d, pattern: 1 }
    : surface === 'grass'
      ? { a: 0x1f4c2b, b: 0x557f43, pattern: 2 }
      : { a: 0x2a5d47, b: 0x6c9563, pattern: 0 };
  runoffUniforms.colorA.value.setHex(runoffStyle.a);
  runoffUniforms.colorB.value.setHex(runoffStyle.b);
  runoffUniforms.pattern.value = runoffStyle.pattern;
};

export const updateSceneMaterialEnvironment = (
  bundle: SceneMaterialBundle,
  elapsed: number,
  wetness: number,
  windX: number,
  windZ: number,
): void => {
  const unique = new Set<ProceduralMaterial>();
  for (const value of Object.values(bundle.materials)) {
    if (Array.isArray(value)) for (const material of value) unique.add(material);
    else if (value instanceof THREE.MeshPhysicalMaterial) unique.add(value as ProceduralMaterial);
  }
  for (const material of unique) {
    const uniforms = material.userData.proceduralUniforms;
    if (!uniforms) continue;
    uniforms.time.value = elapsed;
    uniforms.wetness.value = wetness;
    uniforms.wind.value.set(windX, windZ);
  }
};
