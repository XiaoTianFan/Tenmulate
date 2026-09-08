import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** Keep the control synchronized with native fullscreen, including Escape. */
export function useFullscreen(target: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    const element = target.current;
    const changed = () => setActive(!!element && document.fullscreenElement === element);
    document.addEventListener('fullscreenchange', changed);
    changed();
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      if (element && document.fullscreenElement === element) void document.exitFullscreen().catch(() => undefined);
    };
  }, [target]);

  const toggle = useCallback(async () => {
    if (pending.current) return;
    const element = target.current;
    if (!element) return;
    setError(null);
    if (!document.fullscreenEnabled || typeof element.requestFullscreen !== 'function') {
      setError('Full screen is unavailable in this browser window. Open Tenmulate in a regular browser window to use it.');
      return;
    }
    pending.current = true;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await element.requestFullscreen({ navigationUI: 'hide' });
      setActive(document.fullscreenElement === element);
    } catch {
      setError('Full screen could not start. Try again, or use your browser’s full-screen command.');
    } finally {
      pending.current = false;
    }
  }, [target]);

  return { active, error, toggle, clearError: () => setError(null) };
}
