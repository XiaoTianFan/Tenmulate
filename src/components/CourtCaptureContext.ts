import { createContext, useContext, useSyncExternalStore } from 'react';
import { CourtCapture } from '../engine/capture/CourtCapture';

export const CourtCaptureContext = createContext<CourtCapture | null>(null);

export function useCourtCapture() {
  const capture = useContext(CourtCaptureContext);
  if (!capture) throw new Error('Court capture requires SharedCourtProvider');
  const snapshot = useSyncExternalStore(capture.subscribe, capture.getSnapshot);
  return { capture, ...snapshot };
}
