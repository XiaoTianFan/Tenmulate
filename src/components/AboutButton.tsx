import { t } from '../i18n/locale';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import type { AppRoute } from './AppHeader';
import './about.css';

const routeHelp: Record<AppRoute, string> = {
  practice: 'Choose your camera and incoming-ball settings, then start Quick Practice. Top-down court lets you drag the opponent and landing zones. Rally also includes your configured return ball toward the blue zone.',
  drills: 'Choose a drill to run, duplicate, export or edit. Custom drills stay in this browser.',
  editor: 'Select an opening or player shot to edit it. WASD moves its player camera; drag to look and wheel to zoom. In Top-down zones, drag the opening opponent, blue player landing or yellow opponent landing. Drag presets onto the timeline and right-click to remove a shot. Preview sequence below the court plays the full drill.',
};

export function AboutButton({ route }: { route: AppRoute }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (open) dialog.current?.showModal(); else dialog.current?.close();
  }, [open]);

  return <>
    <button className="icon-text-button" type="button" aria-label={t("About")} aria-haspopup="dialog" onClick={() => setOpen(true)}><Info size={18} /> {t("About")}</button>
    {createPortal(<dialog ref={dialog} className="about-dialog" aria-labelledby={titleId} onClose={() => setOpen(false)} onKeyDown={event => event.stopPropagation()}>
      <header><h2 id={titleId}>{t("About Tenmulate")}</h2><button type="button" aria-label={t("Close About")} onClick={() => setOpen(false)}>{t("Close")}</button></header>
      {open ? <div className="about-body">
        <p>{t("A first-person tennis rehearsal tool for Quick Practice and custom drills.")}</p>
        <section aria-labelledby={`${titleId}-help`}>
          <h3 id={`${titleId}-help`}>{t("Help")}</h3>
          <p>{t(routeHelp[route])}</p>
          <dl className="shortcut-list">
            <div><dt>{t("Drag the court")}</dt><dd>{t("Drag outside the landing zone to look around. Scroll to zoom.")}</dd></div>
            <div><dt>{t("Landing zone")}</dt><dd>{t("Drag inside to move it; drag an edge or corner to resize. Select the zone and use arrow keys for small adjustments.")}</dd></div>
            <div><dt>{t("WASD / Shift")}</dt><dd>{t("Move around the court during setup or shot editing. Hold Shift to move faster.")}</dd></div>
            <div><dt>{t("PgUp / PgDn")}</dt><dd>{t("Raise or lower the camera.")}</dd></div>
            <div><dt>{t("Ctrl+W / Ctrl+S")}</dt><dd>{t("Raise or lower the camera after enabling Protect Ctrl+W/S. Hold Escape to leave protected controls.")}</dd></div>
            <div><dt>{t("Presets")}</dt><dd>{t("Choose a camera position or perspective below the canvas. Right-click a preset to update it.")}</dd></div>
            <div><dt>{t("Space")}</dt><dd>{t("Pause or resume practice.")}</dd></div>
          </dl>
        </section>
        <section className="about-contact" aria-labelledby={`${titleId}-contact`}>
          <h3 id={`${titleId}-contact`}>{t("Contact")}</h3>
          <p>{t("Created by")} <a href="https://www.xiaotianfanx.com/" target="_blank" rel="noopener noreferrer">Xiaotian Fan (GleeGen)</a></p>
          <a href="mailto:xiaotianfanx@email.com">{t("xiaotianfanx@email.com")}</a>
        </section>
      </div> : null}
    </dialog>, document.body)}
  </>;
}
