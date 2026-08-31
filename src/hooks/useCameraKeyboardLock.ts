import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type BrowserKeyboard = Readonly<{
  lock: (keyCodes?: readonly string[]) => Promise<void>;
  unlock: () => void;
}>;

type NavigatorWithKeyboard = Navigator & Readonly<{ keyboard?: BrowserKeyboard }>;
type FullscreenOptionsWithKeyboardLock = FullscreenOptions & Readonly<{ keyboardLock: 'browser' }>;

export type CameraKeyboardLockStatus = 'idle' | 'requesting' | 'locked' | 'unsupported' | 'failed';

const browserKeyboard = (): BrowserKeyboard | undefined => (
  typeof navigator === 'undefined' ? undefined : (navigator as NavigatorWithKeyboard).keyboard
);

const keyboardLockSupported = (): boolean => (
  typeof document !== 'undefined'
  && document.fullscreenEnabled
  && typeof document.documentElement.requestFullscreen === 'function'
);

const IDLE_MESSAGE = 'Protected controls use fullscreen keyboard access so Ctrl+W/S reach the court.';
const UNSUPPORTED_MESSAGE = 'This browser cannot lock Ctrl+W/S. Use Page Up and Page Down for camera height.';
const ENDED_EARLY_MESSAGE = 'This browser exited protected fullscreen, so Ctrl+W remains reserved. Use Page Up/Page Down here or open Tenmulate in Chrome.';

export function useCameraKeyboardLock() {
  const supported = useMemo(keyboardLockSupported, []);
  const initialStatus: CameraKeyboardLockStatus = supported ? 'idle' : 'unsupported';
  const [status, setStatus] = useState<CameraKeyboardLockStatus>(initialStatus);
  const [message, setMessage] = useState(supported ? IDLE_MESSAGE : UNSUPPORTED_MESSAGE);
  const statusRef = useRef<CameraKeyboardLockStatus>(initialStatus);
  const ownsFullscreen = useRef(false);
  const expectedExit = useRef<'idle' | 'failed' | null>(null);
  const lockedAt = useRef(0);

  const updateStatus = useCallback((nextStatus: CameraKeyboardLockStatus, nextMessage: string) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
    setMessage(nextMessage);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (document.fullscreenElement) return;
      browserKeyboard()?.unlock();
      const exitMode = expectedExit.current;
      expectedExit.current = null;
      const ownedFullscreen = ownsFullscreen.current;
      ownsFullscreen.current = false;
      if (exitMode === 'failed') return;
      if (exitMode === 'idle') {
        updateStatus(supported ? 'idle' : 'unsupported', supported ? IDLE_MESSAGE : UNSUPPORTED_MESSAGE);
        return;
      }
      const endedDuringAcquisition = ownedFullscreen && (
        statusRef.current === 'requesting'
        || (statusRef.current === 'locked' && performance.now() - lockedAt.current < 1_500)
      );
      updateStatus(
        endedDuringAcquisition ? 'failed' : supported ? 'idle' : 'unsupported',
        endedDuringAcquisition ? ENDED_EARLY_MESSAGE : supported ? IDLE_MESSAGE : UNSUPPORTED_MESSAGE,
      );
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      browserKeyboard()?.unlock();
      if (ownsFullscreen.current && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [supported, updateStatus]);

  const enable = useCallback(async () => {
    if (!supported) {
      updateStatus('unsupported', UNSUPPORTED_MESSAGE);
      return;
    }

    const keyboard = browserKeyboard();
    updateStatus('requesting', 'Waiting for fullscreen keyboard permission…');
    const shouldEnterFullscreen = !document.fullscreenElement;
    let fullscreenRequestedWithKeyboardLock = false;
    try {
      if (shouldEnterFullscreen) {
        try {
          await document.documentElement.requestFullscreen({
            navigationUI: 'hide',
            keyboardLock: 'browser',
          } as FullscreenOptionsWithKeyboardLock);
          fullscreenRequestedWithKeyboardLock = true;
        } catch (error) {
          if ((error as { name?: unknown })?.name !== 'NotSupportedError' || !keyboard) throw error;
          await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        }
        ownsFullscreen.current = true;
      }
      if (!fullscreenRequestedWithKeyboardLock) {
        if (keyboard) await keyboard.lock(['KeyW', 'KeyS']);
        else throw new Error('Keyboard Lock is unavailable in this browser.');
      }
      if (!document.fullscreenElement) throw new Error('The browser ended fullscreen before keyboard protection became active.');
      lockedAt.current = performance.now();
      updateStatus('locked', 'Ctrl+W/S are locked to camera height. Hold Escape to leave protected controls.');
    } catch (error) {
      keyboard?.unlock();
      updateStatus('failed', error instanceof Error
        ? `Keyboard protection was not enabled: ${error.message}`
        : 'Keyboard protection was not enabled. Allow fullscreen keyboard access and try again.');
      if (ownsFullscreen.current && document.fullscreenElement) {
        expectedExit.current = 'failed';
        await document.exitFullscreen().catch(() => undefined);
      }
      ownsFullscreen.current = false;
    }
  }, [supported, updateStatus]);

  const disable = useCallback(async () => {
    browserKeyboard()?.unlock();
    updateStatus(supported ? 'idle' : 'unsupported', supported ? IDLE_MESSAGE : UNSUPPORTED_MESSAGE);
    if (ownsFullscreen.current && document.fullscreenElement) {
      expectedExit.current = 'idle';
      await document.exitFullscreen().catch(() => undefined);
    }
    ownsFullscreen.current = false;
  }, [supported, updateStatus]);

  return {
    active: status === 'locked',
    disable,
    enable,
    message,
    status,
    supported,
  } as const;
}
