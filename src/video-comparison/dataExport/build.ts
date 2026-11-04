import { motionAnalysisData, motionPlotsData } from './motion';
import { serveSpeedData } from './serve';
import type { DataExportRequest } from './types';
export function buildDataExport(request: DataExportRequest) {
  return request.section === 'motion-analysis'
    ? motionAnalysisData(request.clip)
    : request.section === 'motion-plots'
      ? motionPlotsData(request.clip)
      : serveSpeedData(request);
}
