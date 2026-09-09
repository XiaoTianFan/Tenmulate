import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import type { AppRoute } from './AppHeader';
import './about.css';

const routeHelp: Record<AppRoute, string> = {
  practice: 'Choose your camera and incoming-ball settings, then start Quick Practice.',
  drills: 'Choose a drill to run, duplicate, export or edit. Custom drills stay in this browser.',
  editor: 'Filter default or saved shots and drag them onto the timeline. Right-click a timeline event to remove it. Use Top-down zones to move or resize the incoming landing zone and your return landing zone across the net. Test drill plays the full sequence.',
};

export function AboutButton({ route }: { route: AppRoute }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (open) dialog.current?.showModal(); else dialog.current?.close();
  }, [open]);

  return <>
    <button className="icon-text-button" type="button" aria-label="About" aria-haspopup="dialog" onClick={() => setOpen(true)}><Info size={18} /> About</button>
    {createPortal(<dialog ref={dialog} className="about-dialog" aria-labelledby={titleId} onClose={() => setOpen(false)} onKeyDown={event => event.stopPropagation()}>
      <header><h2 id={titleId}>About Tenmulate</h2><button type="button" aria-label="Close About" onClick={() => setOpen(false)}>Close</button></header>
      {open ? <div className="about-body">
        <p>A first-person tennis rehearsal tool for Quick Practice and custom drills.</p>
        <section aria-labelledby={`${titleId}-help`}>
          <h3 id={`${titleId}-help`}>Help</h3>
          <p>{routeHelp[route]}</p>
          <dl className="shortcut-list">
            <div><dt>Drag the court</dt><dd>Drag outside the landing zone to look around. Scroll to zoom.</dd></div>
            <div><dt>Landing zone</dt><dd>Drag inside to move it; drag an edge or corner to resize. Select the zone and use arrow keys for small adjustments.</dd></div>
            <div><dt>WASD / Shift</dt><dd>Move around the court during setup or shot editing. Hold Shift to move faster.</dd></div>
            <div><dt>PgUp / PgDn</dt><dd>Raise or lower the camera.</dd></div>
            <div><dt>Ctrl+W / Ctrl+S</dt><dd>Raise or lower the camera after enabling Protect Ctrl+W/S. Hold Escape to leave protected controls.</dd></div>
            <div><dt>Presets</dt><dd>Choose a camera position or perspective below the canvas. Right-click a preset to update it.</dd></div>
            <div><dt>Space</dt><dd>Pause or resume practice.</dd></div>
          </dl>
        </section>
        <section className="about-contact" aria-labelledby={`${titleId}-contact`}>
          <h3 id={`${titleId}-contact`}>Contact</h3>
          <p>Created by <a href="https://www.xiaotianfanx.com/" target="_blank" rel="noopener noreferrer">Xiaotian Fan (GleeGen)</a></p>
          <a href="mailto:xiaotianfanx@email.com">xiaotianfanx@email.com</a>
        </section>
      </div> : null}
    </dialog>, document.body)}
  </>;
}
