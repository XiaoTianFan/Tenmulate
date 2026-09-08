import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const vertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

/** One stadium render, a depth-tested ball-only mask, two small blur passes, one composite. */
export class BallFocusPass {
  private readonly color = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, samples: 2,
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
  });
  private readonly mask = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  private readonly horizontal = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  private readonly vertical = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  private readonly maskScene = new THREE.Scene();
  private readonly masks: THREE.Mesh[] = [];
  private readonly size = new THREE.Vector2();
  private readonly cssSize = new THREE.Vector2();
  private readonly maskMaterial = new THREE.ShaderMaterial({
    uniforms: { sceneDepth: { value: this.color.depthTexture }, resolution: { value: this.size }, focus: { value: 0 } },
    vertexShader: `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform sampler2D sceneDepth; uniform vec2 resolution; uniform float focus;
      void main() {
        float depth = texture2D(sceneDepth, gl_FragCoord.xy / resolution).r;
        if (gl_FragCoord.z > depth + .0000002) discard;
        gl_FragColor = vec4(1., focus, 0., 1.);
      }`,
    depthTest: false, depthWrite: false, toneMapped: false,
  });
  private readonly blur = new THREE.ShaderMaterial({
    uniforms: {
      source: { value: this.color.texture }, ballMask: { value: this.mask.texture },
      direction: { value: new THREE.Vector2() }, firstPass: { value: true },
    },
    vertexShader,
    fragmentShader: `varying vec2 vUv; uniform sampler2D source; uniform sampler2D ballMask;
      uniform vec2 direction; uniform bool firstPass;
      vec4 sampleAt(vec2 uv) {
        vec4 color = texture2D(source, uv);
        return vec4(color.rgb, firstPass ? texture2D(ballMask, uv).g : color.a);
      }
      void main() {
        gl_FragColor = sampleAt(vUv) * .227027;
        gl_FragColor += (sampleAt(vUv + direction * 1.384615) + sampleAt(vUv - direction * 1.384615)) * .316216;
        gl_FragColor += (sampleAt(vUv + direction * 3.230769) + sampleAt(vUv - direction * 3.230769)) * .070270;
      }`,
    depthTest: false, depthWrite: false, toneMapped: false,
  });
  private readonly composite = new THREE.ShaderMaterial({
    uniforms: {
      source: { value: this.color.texture }, blurred: { value: this.vertical.texture },
      ballMask: { value: this.mask.texture }, blurMix: { value: 0 }, glow: { value: 0 },
    },
    vertexShader,
    fragmentShader: `varying vec2 vUv; uniform sampler2D source; uniform sampler2D blurred;
      uniform sampler2D ballMask; uniform float blurMix; uniform float glow;
      void main() {
        vec4 soft = texture2D(blurred, vUv);
        float sharpBall = texture2D(ballMask, vUv).r;
        vec3 color = mix(texture2D(source, vUv).rgb, soft.rgb, blurMix * (1. - sharpBall));
        color += vec3(1., .95, .56) * soft.a * (1. - sharpBall) * glow;
        gl_FragColor = vec4(color, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
  private readonly quad = new FullScreenQuad(this.blur);

  constructor() { this.maskScene.background = new THREE.Color(0); }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera,
    balls: readonly THREE.Mesh[], strength: number, maxBlurPx: number): void {
    renderer.getDrawingBufferSize(this.size);
    renderer.getSize(this.cssSize);
    this.color.setSize(this.size.x, this.size.y);
    this.mask.setSize(this.size.x, this.size.y);
    // Half CSS resolution bounds fill cost independently of the display pixel ratio.
    const width = Math.max(1, Math.ceil(this.cssSize.x / 2)), height = Math.max(1, Math.ceil(this.cssSize.y / 2));
    this.horizontal.setSize(width, height); this.vertical.setSize(width, height);
    const previousTarget = renderer.getRenderTarget(), autoReset = renderer.info.autoReset;
    renderer.info.autoReset = false; renderer.info.reset();
    try {
      renderer.setRenderTarget(this.color);
      renderer.render(scene, camera);
      while (this.masks.length < balls.length) {
        const mesh = new THREE.Mesh(balls[this.masks.length]!.geometry, this.maskMaterial);
        const ball = balls[this.masks.length]!;
        mesh.onBeforeRender = () => {
          this.maskMaterial.uniforms.focus!.value = ball.userData.focusWeight ?? 0;
          this.maskMaterial.uniformsNeedUpdate = true;
        };
        mesh.matrixAutoUpdate = false;
        this.maskScene.add(mesh); this.masks.push(mesh);
      }
      for (let i = 0; i < this.masks.length; i++) {
        const ball = balls[i], mask = this.masks[i]!;
        mask.visible = !!ball?.visible;
        if (ball) mask.matrix.copy(ball.matrixWorld);
      }
      renderer.setRenderTarget(this.mask); renderer.render(this.maskScene, camera);
      // Kernel sigma is about 1.7 texels. Keep the configured ceiling in CSS pixels.
      const sigma = Math.max(1, maxBlurPx * strength), step = sigma / 1.7;
      this.blur.uniforms.source!.value = this.color.texture;
      this.blur.uniforms.firstPass!.value = true;
      this.blur.uniforms.direction!.value.set(step / this.cssSize.x, 0);
      this.quad.material = this.blur;
      renderer.setRenderTarget(this.horizontal); this.quad.render(renderer);
      this.blur.uniforms.source!.value = this.horizontal.texture;
      this.blur.uniforms.firstPass!.value = false;
      this.blur.uniforms.direction!.value.set(0, step / this.cssSize.y);
      renderer.setRenderTarget(this.vertical); this.quad.render(renderer);
      this.composite.uniforms.blurMix!.value = Math.min(1, maxBlurPx * strength);
      this.composite.uniforms.glow!.value = strength * 2.2;
      this.quad.material = this.composite;
      renderer.setRenderTarget(previousTarget); this.quad.render(renderer);
    } finally {
      renderer.setRenderTarget(previousTarget); renderer.info.autoReset = autoReset;
    }
  }

  dispose(): void {
    this.color.dispose(); this.mask.dispose(); this.horizontal.dispose(); this.vertical.dispose();
    this.maskMaterial.dispose(); this.blur.dispose(); this.composite.dispose(); this.quad.dispose();
    // Mask meshes borrow the gameplay ball geometry; only TennisScene owns it.
    this.maskScene.clear(); this.masks.length = 0;
  }
}
