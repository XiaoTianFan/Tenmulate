import { t } from '../i18n/locale';
import { CastingButton } from './CastingButton';
import { AboutButton } from './AboutButton';
import { LanguageControl } from './LanguageControl';

export type AppRoute = 'practice' | 'drills' | 'editor';

type AppHeaderProps = Readonly<{
  route: AppRoute;
  onRoute: (route: AppRoute) => void;
}>;

export function AppHeader({ route, onRoute }: AppHeaderProps) {
  return (
    <header className="app-header">
      <strong className="wordmark">Tenmulate</strong>
      <nav aria-label={t("Primary navigation")}>
        <button className={route === 'practice' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => onRoute('practice')}>{t("Practice")}</button>
        <button className={route === 'drills' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => onRoute('drills')}>{t("Drills")}</button>
        <button className={route === 'editor' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => onRoute('editor')}>{t("Editor")}</button>
      </nav>
      <div className="header-actions">
        <LanguageControl />
        <CastingButton />
        <AboutButton route={route} />
      </div>
    </header>
  );
}
