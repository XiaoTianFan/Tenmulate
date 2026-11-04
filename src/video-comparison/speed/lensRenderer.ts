import { distortLens } from './lens';

/** One modal owns one tiny GPU warp. CPU remapping is bounded and used if WebGL
 * is unavailable/lost. Neither path changes the file or allocates a video decoder. */
export class LensRenderer {
  private surface = document.createElement('canvas');
  private gl: WebGLRenderingContext | null;
  private program?: WebGLProgram;
  private texture?: WebGLTexture;
  private buffer?: WebGLBuffer;
  private map?: {
    key: string;
    x: Float32Array;
    y: Float32Array;
    output: ImageData;
  };
  private scratch = document.createElement('canvas');
  constructor() {
    this.gl = this.surface.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: true
    });
    const gl = this.gl;
    if (!gl) return;
    const shaders: WebGLShader[] = [];
    try {
      const shader = (kind: number, source: string) => {
        const object = gl.createShader(kind)!;
        shaders.push(object);
        gl.shaderSource(object, source);
        gl.compileShader(object);
        if (!gl.getShaderParameter(object, gl.COMPILE_STATUS)) throw new Error('shader');
        return object;
      };
      this.program = gl.createProgram()!;
      gl.attachShader(
        this.program,
        shader(
          gl.VERTEX_SHADER,
          `attribute vec2 position; varying vec2 uv;
        void main(){uv=(position+1.0)*0.5;gl_Position=vec4(position,0.0,1.0);}`
        )
      );
      gl.attachShader(
        this.program,
        shader(
          gl.FRAGMENT_SHADER,
          `precision highp float;
        varying vec2 uv; uniform sampler2D picture; uniform vec2 size; uniform float strength;
        void main(){
          vec2 delta=uv-0.5; float target=length(delta*size)/(length(size)*0.5);
          float scale=1.0/(1.0+max(0.0,strength)*0.5); float r=target/scale;
          for(int i=0;i<12;i++){
            float q=r*r;
            float f=scale*r*(1.0+strength*q/(1.0+q))-target;
            float d=scale*(1.0+strength*q*(3.0+q)/((1.0+q)*(1.0+q)));
            r=max(0.0,r-f/d);
          }
          vec2 source=0.5+delta*(target>0.0?r/target:1.0);
          gl_FragColor=any(lessThan(source,vec2(0.0)))||any(greaterThan(source,vec2(1.0)))
            ?vec4(0.0,0.0,0.0,1.0):texture2D(picture,source);
        }`
        )
      );
      gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error('program');
      gl.useProgram(this.program);
      this.buffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(this.program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      this.texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    } catch {
      this.releaseGPU();
    } finally {
      shaders.forEach((s) => gl.deleteShader(s));
    }
  }
  draw(source: HTMLCanvasElement, output: HTMLCanvasElement, strength: number) {
    const context = output.getContext('2d', { alpha: false })!;
    const gpu = this.gl && !this.gl.isContextLost();
    // Software fallback keeps memory and per-frame work bounded on older devices.
    const scale = strength && !gpu ? Math.min(1, 1280 / Math.max(source.width, source.height)) : 1;
    const width = Math.max(1, Math.round(source.width * scale)),
      height = Math.max(1, Math.round(source.height * scale));
    if (output.width !== width || output.height !== height) {
      output.width = width;
      output.height = height;
    }
    if (!strength) {
      context.drawImage(source, 0, 0, width, height);
      return;
    }
    const gl = this.gl;
    if (gpu && gl && this.program) {
      this.surface.width = width;
      this.surface.height = height;
      gl.viewport(0, 0, width, height);
      gl.useProgram(this.program);
      gl.uniform2f(gl.getUniformLocation(this.program, 'size'), source.width, source.height);
      gl.uniform1f(gl.getUniformLocation(this.program, 'strength'), strength);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!gl.isContextLost() && gl.getError() === gl.NO_ERROR) {
        context.drawImage(this.surface, 0, 0);
        return;
      }
      this.releaseGPU();
      this.draw(source, output, strength);
      return;
    }
    if (this.scratch.width !== width || this.scratch.height !== height) {
      this.scratch.width = width;
      this.scratch.height = height;
    }
    const scratch = this.scratch.getContext('2d', {
      willReadFrequently: true
    })!;
    scratch.drawImage(source, 0, 0, width, height);
    const pixels = scratch.getImageData(0, 0, width, height).data;
    const key = `${width}:${height}:${strength}`;
    if (this.map?.key !== key) {
      const x = new Float32Array(width * height),
        y = new Float32Array(width * height);
      // The inverse scale depends only on radius. A tiny radial lookup avoids
      // solving a nonlinear equation separately for a million output pixels.
      const count = 4096,
        inverse = new Float32Array(count + 1);
      inverse[0] = 1 + Math.max(0, strength) / 2;
      for (let i = 1; i <= count; i++) {
        const r = i / count,
          p = distortLens({ x: 0.5 + r / 2, y: 0.5 }, strength, 2, 0);
        inverse[i] = ((p.x - 0.5) * 2) / r;
      }
      const radius = Math.hypot(width, height) / 2;
      for (let row = 0; row < height; row++)
        for (let col = 0; col < width; col++) {
          const dx = col + 0.5 - width / 2,
            dy = row + 0.5 - height / 2;
          const n = (Math.sqrt(dx * dx + dy * dy) / radius) * count,
            at = Math.min(count - 1, Math.floor(n)),
            f = n - at;
          const scale = inverse[at] + (inverse[at + 1] - inverse[at]) * f,
            i = row * width + col;
          x[i] = width / 2 + dx * scale - 0.5;
          y[i] = height / 2 + dy * scale - 0.5;
        }
      this.map = { key, x, y, output: new ImageData(width, height) };
    }
    const { x, y, output: image } = this.map,
      data = image.data;
    for (let i = 0; i < x.length; i++) {
      const px = x[i],
        py = y[i],
        out = i * 4;
      data[out + 3] = 255;
      if (px < -0.5 || py < -0.5 || px >= width - 0.5 || py >= height - 0.5) {
        data[out] = data[out + 1] = data[out + 2] = 0;
        continue;
      }
      const sx = Math.max(0, Math.min(width - 1, px)),
        sy = Math.max(0, Math.min(height - 1, py));
      const a = Math.floor(sx),
        b = Math.floor(sy),
        fx = sx - a,
        fy = sy - b;
      const p = (b * width + a) * 4,
        q = (b * width + Math.min(width - 1, a + 1)) * 4;
      const r = (Math.min(height - 1, b + 1) * width + a) * 4,
        s = (Math.min(height - 1, b + 1) * width + Math.min(width - 1, a + 1)) * 4;
      for (let c = 0; c < 3; c++)
        data[out + c] =
          (pixels[p + c] * (1 - fx) + pixels[q + c] * fx) * (1 - fy) +
          (pixels[r + c] * (1 - fx) + pixels[s + c] * fx) * fy;
    }
    context.putImageData(image, 0, 0);
  }
  private releaseGPU() {
    const gl = this.gl;
    if (gl) {
      if (this.texture) gl.deleteTexture(this.texture);
      if (this.buffer) gl.deleteBuffer(this.buffer);
      if (this.program) gl.deleteProgram(this.program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.gl = null;
  }
  dispose() {
    this.releaseGPU();
    this.map = undefined;
    this.surface.width = this.surface.height = this.scratch.width = this.scratch.height = 0;
  }
}
