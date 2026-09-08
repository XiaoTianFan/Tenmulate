import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { LENS_FOCUS_GLSL } from './lensFocus';

const BALL_LAYER = 31;
const vertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const depthGLSL = `
  uniform sampler2D sceneDepth;
  uniform float nearClip;
  uniform float farClip;
  float viewDepth(vec2 uv) {
    float d = texture2D(sceneDepth, uv).r;
    return nearClip * farClip / (farClip - d * (farClip - nearClip));
  }
`;

type BallState = { mesh: THREE.Mesh; original: THREE.MeshStandardMaterial; layerMask: number;
  colorWrite: boolean; depthWrite: boolean; sharp: THREE.MeshStandardMaterial };

/** A depth-dependent lens pass with a separate, never-filtered ball color layer. */
export class BallFocusPass {
  private readonly color = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, samples: 2,
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
  });
  private readonly sharpBall = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 });
  private readonly prefiltered = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  private readonly blurred = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  private readonly size = new THREE.Vector2();
  private readonly cssSize = new THREE.Vector2();
  private readonly clearColor = new THREE.Color();
  private readonly ballBounds = new THREE.Vector4(1, 1, 0, 0);
  private readonly previousBounds = new THREE.Vector4(1, 1, 0, 0);
  private readonly viewCenter = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly worldScale = new THREE.Vector3();
  private readonly ballStates: BallState[] = [];
  private readonly lights: THREE.Light[] = [];
  private readonly lightMasks: number[] = [];
  private readonly depthUniforms = {
    sceneDepth: { value: this.color.depthTexture }, nearClip: { value: .05 }, farClip: { value: 350 },
  };
  private readonly lensUniforms = { focusDistance: { value: 16 }, maximumRadius: { value: 0 } };
  private readonly prefilter = new THREE.ShaderMaterial({
    uniforms: { ...this.depthUniforms, source: { value: this.color.texture }, texel: { value: new THREE.Vector2() } },
    vertexShader,
    fragmentShader: `varying vec2 vUv; uniform sampler2D source; uniform vec2 texel;
      ${depthGLSL}
      void main() {
        vec2 uv0 = vUv + texel * vec2(-.5, -.5), uv1 = vUv + texel * vec2(.5, -.5);
        vec2 uv2 = vUv + texel * vec2(-.5, .5), uv3 = vUv + texel * vec2(.5, .5);
        vec4 z = vec4(viewDepth(uv0), viewDepth(uv1), viewDepth(uv2), viewDepth(uv3));
        float nearest = min(min(z.x,z.y), min(z.z,z.w));
        // Preserve the foreground surface at depth discontinuities during downsampling.
        vec4 w = 1. - smoothstep(vec4(.02), vec4(max(.08, nearest * .02)), abs(z - nearest));
        vec3 color = texture2D(source,uv0).rgb*w.x + texture2D(source,uv1).rgb*w.y
          + texture2D(source,uv2).rgb*w.z + texture2D(source,uv3).rgb*w.w;
        gl_FragColor = vec4(color / dot(w,vec4(1.)), nearest);
      }`,
    depthTest: false, depthWrite: false, toneMapped: false,
  });
  private readonly gather = new THREE.ShaderMaterial({
    uniforms: { ...this.lensUniforms, source: { value: this.prefiltered.texture }, cssSize: { value: this.cssSize } },
    vertexShader,
    fragmentShader: `varying vec2 vUv; uniform sampler2D source; uniform vec2 cssSize;
      ${LENS_FOCUS_GLSL}
      void main() {
        vec4 center = texture2D(source, vUv);
        float centerCoc = circleOfConfusion(center.a);
        vec3 farColor = center.rgb;
        float farWeight = 1.;
        vec3 nearColor = vec3(0.);
        float nearWeight = 0.;
        // A stable disk pattern avoids time-varying noise during camera/ball motion.
        for (int i = 0; i < 16; i++) {
          float radius = sqrt((float(i) + .5) / 16.);
          float angle = float(i) * 2.39996323;
          vec2 offset = vec2(cos(angle), sin(angle)) * radius * maximumRadius;
          vec4 sampleColor = texture2D(source, vUv + offset / cssSize);
          float sampleCoc = circleOfConfusion(sampleColor.a);
          float distancePx = radius * maximumRadius;
          float centerReach = 1. - smoothstep(abs(centerCoc) - .65, abs(centerCoc) + .65, distancePx);
          float sampleReach = 1. - smoothstep(abs(sampleCoc) - .65, abs(sampleCoc) + .65, distancePx);
          float depthTolerance = max(.08, center.a * .025);
          // Sharp foreground pixels cannot smear into an out-of-focus far surface.
          float background = smoothstep(-depthTolerance, 0., sampleColor.a - center.a);
          float weight = centerReach * sampleReach * background;
          farColor += sampleColor.rgb * weight; farWeight += weight;
          // Gather the footprint of a defocused foreground object beyond its edge.
          float foreground = 1. - smoothstep(0., depthTolerance, sampleColor.a - center.a);
          float near = sampleReach * foreground * smoothstep(.35, 1.5, -sampleCoc)
            * maximumRadius * maximumRadius / max(1., sampleCoc * sampleCoc);
          nearColor += sampleColor.rgb * near; nearWeight += near;
        }
        farColor /= farWeight;
        nearColor /= max(.0001, nearWeight);
        float coverage = clamp(nearWeight / 16., 0., 1.);
        float blend = max(blurCoverage(centerCoc), coverage);
        gl_FragColor = vec4(mix(farColor, nearColor, coverage / max(.0001, blend)), coverage);
      }`,
    depthTest: false, depthWrite: false, toneMapped: false,
  });
  private readonly composite = new THREE.ShaderMaterial({
    uniforms: { ...this.depthUniforms, ...this.lensUniforms,
      source: { value: this.color.texture }, lens: { value: this.blurred.texture },
      sharpBall: { value: this.sharpBall.texture }, glow: { value: 0 }, cssSize: { value: this.cssSize },
      ballBounds: { value: this.ballBounds },
    },
    vertexShader,
    fragmentShader: `varying vec2 vUv;
      uniform sampler2D source; uniform sampler2D lens; uniform sampler2D sharpBall;
      uniform float glow; uniform vec2 cssSize; uniform vec4 ballBounds;
      ${depthGLSL}
      ${LENS_FOCUS_GLSL}
      void main() {
        vec3 color = texture2D(source, vUv).rgb;
        if (maximumRadius > .001) {
          vec4 soft = texture2D(lens, vUv);
          float blend = max(blurCoverage(circleOfConfusion(viewDepth(vUv))), soft.a);
          color = mix(color, soft.rgb, blend);
        }
        if (vUv.x >= ballBounds.x && vUv.y >= ballBounds.y && vUv.x <= ballBounds.z && vUv.y <= ballBounds.w) {
        vec4 ball = texture2D(sharpBall, vUv);
        // A restrained, fixed-width rim stays outside the silhouette and never
        // spreads the ball color into the lens blur. MSAA coverage is premultiplied.
        vec2 d = vec2(1.2) / cssSize;
        float halo = (texture2D(sharpBall, vUv + vec2(d.x,0.)).a
          + texture2D(sharpBall, vUv - vec2(d.x,0.)).a
          + texture2D(sharpBall, vUv + vec2(0.,d.y)).a
          + texture2D(sharpBall, vUv - vec2(0.,d.y)).a) * .25;
        color += vec3(1., .95, .56) * max(0., halo - ball.a) * glow;
        color = color * (1. - ball.a) + ball.rgb;
        }
        gl_FragColor = vec4(color, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
  private readonly quad = new FullScreenQuad(this.prefilter);

  private stateFor(ball: THREE.Mesh): BallState {
    let state = this.ballStates.find(item => item.mesh === ball);
    if (state) return state;
    const original = ball.material as THREE.MeshStandardMaterial, sharp = original.clone();
    sharp.onBeforeCompile = shader => {
      shader.uniforms.focusSceneDepth = this.depthUniforms.sceneDepth;
      shader.uniforms.focusResolution = { value: this.size };
      shader.fragmentShader = `uniform sampler2D focusSceneDepth; uniform vec2 focusResolution;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `
        #include <clipping_planes_fragment>
        float worldDepth = texture2D(focusSceneDepth, gl_FragCoord.xy / focusResolution).r;
        if (gl_FragCoord.z > worldDepth + max(.0000002, fwidth(gl_FragCoord.z) * .75)) discard;
      `);
    };
    sharp.customProgramCacheKey = () => 'sharp-ball-over-world-depth-v1';
    state = { mesh: ball, original, sharp, layerMask: ball.layers.mask, colorWrite: original.colorWrite, depthWrite: original.depthWrite };
    this.ballStates.push(state);
    return state;
  }

  private updateBallBounds(balls: readonly THREE.Mesh[], camera: THREE.PerspectiveCamera, resized: boolean): void {
    this.ballBounds.set(1, 1, 0, 0);
    for (const ball of balls) {
      if (!ball.visible) continue;
      if (!ball.geometry.boundingSphere) ball.geometry.computeBoundingSphere();
      ball.getWorldPosition(this.viewCenter).applyMatrix4(camera.matrixWorldInverse);
      ball.getWorldScale(this.worldScale);
      const radius = ball.geometry.boundingSphere!.radius * Math.max(this.worldScale.x, this.worldScale.y, this.worldScale.z);
      if (this.viewCenter.z - radius >= -camera.near) continue;
      if (this.viewCenter.z + radius >= -camera.near) { this.ballBounds.set(0, 0, 1, 1); break; }
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
        this.projected.set(this.viewCenter.x + x * radius, this.viewCenter.y + y * radius, this.viewCenter.z + z * radius).applyMatrix4(camera.projectionMatrix);
        const u = this.projected.x * .5 + .5, v = this.projected.y * .5 + .5;
        this.ballBounds.x = Math.min(this.ballBounds.x, u); this.ballBounds.y = Math.min(this.ballBounds.y, v);
        this.ballBounds.z = Math.max(this.ballBounds.z, u); this.ballBounds.w = Math.max(this.ballBounds.w, v);
      }
    }
    if (this.ballBounds.x <= this.ballBounds.z) {
      // Include the rim taps and antialiasing footprint at any device pixel ratio.
      this.ballBounds.x = Math.max(0, this.ballBounds.x - 4 / this.cssSize.x);
      this.ballBounds.y = Math.max(0, this.ballBounds.y - 4 / this.cssSize.y);
      this.ballBounds.z = Math.min(1, this.ballBounds.z + 4 / this.cssSize.x);
      this.ballBounds.w = Math.min(1, this.ballBounds.w + 4 / this.cssSize.y);
    }
    const left = Math.floor(Math.min(this.ballBounds.x, this.previousBounds.x) * this.size.x);
    const bottom = Math.floor(Math.min(this.ballBounds.y, this.previousBounds.y) * this.size.y);
    const right = Math.ceil(Math.max(this.ballBounds.z, this.previousBounds.z) * this.size.x);
    const top = Math.ceil(Math.max(this.ballBounds.w, this.previousBounds.w) * this.size.y);
    this.sharpBall.scissorTest = !resized;
    this.sharpBall.scissor.set(left, bottom, Math.max(1, right - left), Math.max(1, top - bottom));
    this.previousBounds.copy(this.ballBounds);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera,
    balls: readonly THREE.Mesh[], strength: number, maxBlurPx: number, focusDistance: number): void {
    renderer.getDrawingBufferSize(this.size); renderer.getSize(this.cssSize);
    const resized = this.sharpBall.width !== this.size.x || this.sharpBall.height !== this.size.y;
    this.color.setSize(this.size.x, this.size.y); this.sharpBall.setSize(this.size.x, this.size.y);
    const width = Math.max(1, Math.ceil(this.cssSize.x / 2)), height = Math.max(1, Math.ceil(this.cssSize.y / 2));
    this.prefiltered.setSize(width, height); this.blurred.setSize(width, height);
    this.prefilter.uniforms.texel!.value.set(1 / this.cssSize.x, 1 / this.cssSize.y);
    this.depthUniforms.nearClip.value = camera.near; this.depthUniforms.farClip.value = camera.far;
    this.lensUniforms.focusDistance.value = focusDistance;
    this.lensUniforms.maximumRadius.value = maxBlurPx * strength;
    this.composite.uniforms.glow!.value = strength * .18;
    const target = renderer.getRenderTarget(), autoReset = renderer.info.autoReset, cameraMask = camera.layers.mask;
    const background = scene.background, clearAlpha = renderer.getClearAlpha();
    const shadowAutoUpdate = renderer.shadowMap.autoUpdate, shadowNeedsUpdate = renderer.shadowMap.needsUpdate;
    renderer.getClearColor(this.clearColor);
    renderer.info.autoReset = false; renderer.info.reset();
    this.lights.length = 0; this.lightMasks.length = 0;
    try {
      for (const ball of balls) {
        const state = this.stateFor(ball);
        state.layerMask = ball.layers.mask; state.colorWrite = state.original.colorWrite; state.depthWrite = state.original.depthWrite;
        // Keep the real ball's shadow, but keep all ball color/depth out of the lens input.
        state.original.colorWrite = false; state.original.depthWrite = false;
      }
      renderer.setRenderTarget(this.color); renderer.render(scene, camera);
      this.updateBallBounds(balls, camera, resized);
      for (const state of this.ballStates) {
        state.original.colorWrite = state.colorWrite; state.original.depthWrite = state.depthWrite;
        state.sharp.color.copy(state.original.color); state.sharp.emissive.copy(state.original.emissive);
        state.sharp.emissiveIntensity = state.original.emissiveIntensity;
        state.mesh.material = state.sharp; state.mesh.layers.set(BALL_LAYER);
      }
      // Reuse the actual scene lighting without drawing any stadium geometry again.
      scene.traverseVisible(object => {
        if (object instanceof THREE.Light) {
          this.lights.push(object); this.lightMasks.push(object.layers.mask); object.layers.enable(BALL_LAYER);
        }
      });
      renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
      scene.background = null; camera.layers.set(BALL_LAYER);
      renderer.setClearColor(0, 0);
      renderer.setRenderTarget(this.sharpBall); renderer.render(scene, camera);
      if (this.lensUniforms.maximumRadius.value > .001) {
        this.quad.material = this.prefilter;
        renderer.setRenderTarget(this.prefiltered); this.quad.render(renderer);
        this.quad.material = this.gather;
        renderer.setRenderTarget(this.blurred); this.quad.render(renderer);
      }
      this.quad.material = this.composite;
      renderer.setRenderTarget(target); this.quad.render(renderer);
    } finally {
      for (const state of this.ballStates) {
        state.mesh.material = state.original; state.mesh.layers.mask = state.layerMask;
        state.original.colorWrite = state.colorWrite; state.original.depthWrite = state.depthWrite;
      }
      for (let i = 0; i < this.lights.length; i++) this.lights[i]!.layers.mask = this.lightMasks[i]!;
      scene.background = background; camera.layers.mask = cameraMask;
      renderer.shadowMap.autoUpdate = shadowAutoUpdate; renderer.shadowMap.needsUpdate = shadowNeedsUpdate;
      renderer.setClearColor(this.clearColor, clearAlpha); renderer.setRenderTarget(target);
      renderer.info.autoReset = autoReset;
    }
  }

  dispose(): void {
    this.color.dispose(); this.sharpBall.dispose(); this.prefiltered.dispose(); this.blurred.dispose();
    this.prefilter.dispose(); this.gather.dispose(); this.composite.dispose(); this.quad.dispose();
    for (const state of this.ballStates) state.sharp.dispose();
    this.ballStates.length = 0;
  }
}
