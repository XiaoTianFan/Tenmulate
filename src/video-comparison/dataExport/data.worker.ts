import { buildDataExport } from './build';
import { serializeData } from './common';
import type { DataExportRequest } from './types';
self.onmessage = ({ data }: MessageEvent<DataExportRequest>) => {
  try {
    const json = serializeData(buildDataExport(data));
    const blob = new Blob([json], { type: 'application/json' });
    if (blob.size > 128 * 1024 * 1024)
      throw new Error('Analysis data is too large. Remove unused tracks or analyze a shorter excerpt.');
    self.postMessage({ blob });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Could not export analysis data. Please try again.'
    });
  }
};
