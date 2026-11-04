import { estimateServe } from './estimate';
import { calibrate, CalibrationError } from './geometry';
import type { SpeedRequest } from './types';
self.onmessage = ({ data }: MessageEvent<SpeedRequest>) => {
  try {
    if (data.kind === 'calibrate')
      self.postMessage({ camera: calibrate(data.input.setup, data.input.width, data.input.height) });
    else self.postMessage({ result: estimateServe(data.input, (progress) => self.postMessage({ progress })) });
  } catch (error) {
    self.postMessage({
      error: {
        message: error instanceof Error ? error.message : 'Serve speed estimation failed.',
        mark: error instanceof CalibrationError ? error.mark : undefined,
        pixels: error instanceof CalibrationError ? error.pixels : undefined
      }
    });
  }
};
