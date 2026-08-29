import { registerSW } from 'virtual:pwa-register';
import { updatePwaState } from './pwaStatus';

export const registerPwa = (): void => {
  registerSW({
    immediate: true,
    onOfflineReady: () => updatePwaState({ offlineReady: true }),
    onNeedRefresh: () => updatePwaState({ needsRefresh: true }),
    onRegisterError: (error) => updatePwaState({ error: error instanceof Error ? error.message : String(error) }),
  });
};
