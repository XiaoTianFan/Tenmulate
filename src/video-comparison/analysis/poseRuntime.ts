import * as tf from '@tensorflow/tfjs-core';
import { loadGraphModel, type GraphModel } from '@tensorflow/tfjs-converter';
import { setThreadsCount, setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import type { CropRect } from '../crop';
import type { PixelFrame } from './tracker';
import { PoseFollower } from './poseFollower';

export class PoseRuntime {
  private model?: GraphModel;
  private follower?: PoseFollower;
  async init(progress: (value: number) => void) {
    setWasmPaths(new URL('/assets/analysis/tfjs-4.22.0/', self.location.origin).href); setThreadsCount(1);
    await tf.setBackend('wasm'); await tf.ready();
    this.model = await loadGraphModel('/assets/analysis/movenet-lightning-v4/model.json', { onProgress: progress });
  }
  async detect(frame: PixelFrame, time: number, region?: CropRect, reset = false): Promise<Float32Array> {
    if (reset || !this.follower) this.follower = new PoseFollower(frame.width, frame.height, region);
    let best: Float32Array | undefined, score = -1;
    for (const crop of this.follower.regions(time)) {
      const candidate = await this.detectRegion(frame, crop), quality = this.follower.score(candidate, time);
      if (quality > score) { best = candidate; score = quality; }
      if (quality >= 0 && this.follower.sufficient(candidate, crop)) break;
    }
    this.follower.accept(best, time);
    return best ?? new Float32Array(17 * 3);
  }
  private async detectRegion(frame: PixelFrame, region?: CropRect): Promise<Float32Array> {
    const r = region ?? { x: 0, y: 0, width: 1, height: 1 };
    const left = Math.round(r.x * frame.width), top = Math.round(r.y * frame.height);
    const width = Math.min(frame.width - left, Math.max(1, Math.round(r.width * frame.width))), height = Math.min(frame.height - top, Math.max(1, Math.round(r.height * frame.height)));
    const rgb = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const i = ((y + top) * frame.width + x + left) * 4; rgb.set(frame.rgba.subarray(i, i + 3), (y * width + x) * 3); }
    const side = Math.max(width, height), padX = Math.floor((side - width) / 2), padY = Math.floor((side - height) / 2);
    const input = tf.tidy(() => tf.expandDims(tf.cast(tf.image.resizeBilinear(tf.pad(tf.tensor3d(rgb, [height, width, 3], 'int32'), [[padY, side - height - padY], [padX, side - width - padX], [0, 0]]), [192, 192]), 'int32'), 0));
    let output: tf.Tensor | undefined;
    try {
      output = this.model!.execute(input) as tf.Tensor;
      const data = await output.data(), result = new Float32Array(17 * 3);
      for (let p = 0; p < 17; p++) {
        const x = (data[p * 3 + 1] * side - padX + left) / frame.width, y = (data[p * 3] * side - padY + top) / frame.height;
        result.set([x, y, x < r.x || y < r.y || x > r.x + r.width || y > r.y + r.height ? 0 : data[p * 3 + 2]], p * 3);
      }
      return result;
    } finally { input.dispose(); output?.dispose(); }
  }
  dispose() { this.model?.dispose(); this.model = undefined; }
}
