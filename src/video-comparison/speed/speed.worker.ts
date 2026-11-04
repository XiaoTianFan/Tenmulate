import { estimateServe } from './estimate';
import type { SpeedInput } from './types';
self.onmessage = ({ data }: MessageEvent<SpeedInput>) => {
  try {
    const result = estimateServe(data, (progress) => self.postMessage({ progress }));
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Serve speed estimation failed.' });
  }
};
