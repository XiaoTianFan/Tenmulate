import { useSyncExternalStore } from 'react';

export type PwaState = Readonly<{
  offlineReady: boolean;
  needsRefresh: boolean;
  online: boolean;
  error: string | null;
}>;

let state: PwaState = {
  offlineReady: Boolean(navigator.serviceWorker?.controller),
  needsRefresh: false,
  online: navigator.onLine,
  error: null,
};
const listeners = new Set<() => void>();

const emit = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

window.addEventListener('online', () => emit({ online: true }));
window.addEventListener('offline', () => emit({ online: false }));

export const updatePwaState = emit;

export const usePwaStatus = (): PwaState => useSyncExternalStore(
  (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  () => state,
);
