import { t } from '../i18n/locale';
import { CastingButton } from './CastingButton';
import { AboutButton } from './AboutButton';
import { LanguageControl } from './LanguageControl';

import { APP_PATHS, isPlainNavigation, type AppRoute } from '../app/routes';
export type { AppRoute } from '../app/routes';

type AppHeaderProps = Readonly<{
  route: AppRoute;
  onRoute: (route: AppRoute) => void;
}>;

export function AppHeader({ route, onRoute }: AppHeaderProps) {
  return (
    <header className="app-header">
      <strong className="wordmark">Tenmulate</strong>
      <nav aria-label={t("Primary navigation")}>
        {([['practice', 'Quick Practice'], ['drills', 'Drills'], ['editor', 'Editor'], ['comparison', 'Video Comparison']] as const).map(([key, label]) =>
          <a key={key} href={APP_PATHS[key]} className={route === key ? 'nav-item active' : 'nav-item'} aria-current={route === key ? 'page' : undefined}
            onClick={event => { if (isPlainNavigation(event)) { event.preventDefault(); onRoute(key); } }}>{t(label)}</a>)}
      </nav>
      <div className="header-actions">
        <LanguageControl />
        <CastingButton />
        <AboutButton route={route} />
      </div>
    </header>
  );
}
