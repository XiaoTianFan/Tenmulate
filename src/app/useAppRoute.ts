import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { APP_PATHS, routeFromPath, type AppRoute } from './routes';

/** URL is the reload/bookmark source of truth; in-app navigation retains the
 * existing court, comparison session and editor cache owners. */
export function useAppRoute(onHistoryNavigate: (route: AppRoute) => void) {
  const [route, setRoute] = useState(() => routeFromPath(window.location.pathname));
  const historyNavigate = useRef(onHistoryNavigate);
  useLayoutEffect(() => { historyNavigate.current = onHistoryNavigate; });
  useLayoutEffect(() => {
    const sync = () => {
      const next = routeFromPath(window.location.pathname);
      const canonical = APP_PATHS[next];
      if (window.location.pathname !== canonical) window.history.replaceState(window.history.state, '', canonical + window.location.search + window.location.hash);
      return next;
    };
    sync();
    const backOrForward = () => { const next = sync(); historyNavigate.current(next); setRoute(next); };
    window.addEventListener('popstate', backOrForward);
    return () => window.removeEventListener('popstate', backOrForward);
  }, []);
  const navigate = useCallback((next: AppRoute) => {
    if (window.location.pathname !== APP_PATHS[next]) window.history.pushState(null, '', APP_PATHS[next]);
    setRoute(next);
  }, []);
  return [route, navigate] as const;
}
