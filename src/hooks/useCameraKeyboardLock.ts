import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type BrowserKeyboard = Readonly<{
  lock: (keyCodes?: readonly string[]) => Promise<void>;
  unlock: () => void;
}>;

type NavigatorWithKeyboard = Navigator & Readonly<{ keyboard?: BrowserKeyboard }>;

export type CameraKeyboardLockStatus = 'idle' | 'requesting' | 'locked' | 'unsupported' | 'failed';

const browserKeyboard = (): BrowserKeyboard | undefined => (
  typeof navigator === 'undefined' ? undefined : (navigator as NavigatorWithKeyboard).keyboard
);

const keyboardLockSupported = (): boolean => (
  typeof document !== 'undefined'
  && document.fullscreenEnabled
  && typeof document.documentElement.requestFullscreen === 'function'
  && typeof browserKeyboard()?.lock === 'function'
);

export function useCameraKeyboardLock() {
  const supported = useMemo(keyboardLockSupported, []);
  const [status, setStatus] = useState<CameraKeyboardLockStatus>(supported ? 'idle' : 'unsupported');
  const [message, setMessage] = useState(supported
    ? 'Protected controls use fullscreen keyboard access so Ctrl+W/S reach the court.'
    : 'This browser cannot lock Ctrl+W/S. Use Page Up and Page Down for camera height.');
  const ownsFullscreen = useRef(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (document.fullscreenElement) return;
      browserKeyboard()?.unlock();
      ownsFullscreen.current = false;
      setStatus(supported ? 'idle' : 'unsupported');
      setMessage(supported
        ? 'Protected controls are off. Use Page Up/Page Down, or enable protection for Ctrl+W/S.'
        : 'This browser cannot lock Ctrl+W/S. Use Page Up and Page Down for camera height.');
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      browserKeyboard()?.unlock();
      if (ownsFullscreen.current && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [supported]);

  const enable = useCallback(async () => {
    const keyboard = browserKeyboard();
    if (!supported || !keyboard) {
      setStatus('unsupported');
      setMessage('This browser cannot lock Ctrl+W/S. Use Page Up and Page Down for camera height.');
      return;
    }

    setStatus('requesting');
    setMessage('Waiting for fullscreen keyboard permission…');
    const shouldEnterFullscreen = !document.fullscreenElement;
    try {
      if (shouldEnterFullscreen) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        ownsFullscreen.current = true;
      }
      await keyboard.lock(['KeyW', 'KeyS']);
      setStatus('locked');
      setMessage('Ctrl+W/S are locked to camera height. Hold Escape to leave protected controls.');
    } catch (error) {
      keyboard.unlock();
      if (ownsFullscreen.current && document.fullscreenElement) {
        await document.exitFullscreen().catch(() => undefined);
      }
      ownsFullscreen.current = false;
      setStatus('failed');
      setMessage(error instanceof Error
        ? `Keyboard protection was not enabled: ${error.message}`
        : 'Keyboard protection was not enabled. Allow fullscreen keyboard access and try again.');
    }
  }, [supported]);

  const disable = useCallback(async () => {
    browserKeyboard()?.unlock();
    if (ownsFullscreen.current && document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
    ownsFullscreen.current = false;
    setStatus(supported ? 'idle' : 'unsupported');
    setMessage(supported
      ? 'Protected controls are off. Use Page Up/Page Down, or enable protection for Ctrl+W/S.'
      : 'This browser cannot lock Ctrl+W/S. Use Page Up and Page Down for camera height.');
  }, [supported]);

  return {
    active: status === 'locked',
    disable,
    enable,
    message,
    status,
    supported,
  } as const;
}
