export const APP_PATHS = {
  practice: '/quick-practice', drills: '/drills', editor: '/editor', comparison: '/video-comparison',
} as const;
export type AppRoute = keyof typeof APP_PATHS;
export function routeFromPath(pathname: string): AppRoute {
  const path = pathname.replace(/\/+$/, '') || '/';
  return (Object.entries(APP_PATHS).find(([, value]) => value === path)?.[0] as AppRoute | undefined) ?? 'practice';
}
export function isPlainNavigation(event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean }) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
