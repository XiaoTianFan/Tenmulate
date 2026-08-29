import { CircleHelp, Monitor } from 'lucide-react';

export type AppRoute = 'practice' | 'drills' | 'editor';

type AppHeaderProps = Readonly<{
  route: AppRoute;
  onRoute: (route: AppRoute) => void;
  onDisplay: () => void;
  onHelp: () => void;
}>;

export function AppHeader({ route, onRoute, onDisplay, onHelp }: AppHeaderProps) {
  return (
    <header className="app-header">
      <strong className="wordmark">Tenmulate</strong>
      <nav aria-label="Primary navigation">
        <button className={route === 'practice' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => onRoute('practice')}>Practice</button>
        <button className={route === 'drills' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => onRoute('drills')}>Drills</button>
        <button className={route === 'editor' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => onRoute('editor')}>Editor</button>
      </nav>
      <div className="header-actions">
        <button className="icon-text-button" type="button" onClick={onDisplay}><Monitor size={18} /> Display</button>
        <button className="icon-text-button" type="button" onClick={onHelp}><CircleHelp size={18} /> Help</button>
      </div>
    </header>
  );
}
