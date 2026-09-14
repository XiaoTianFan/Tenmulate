import { t, message as translateMessage } from '../i18n/locale';
import { useEffect, useId, useRef, useState } from 'react';
import { Cast } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCourtCapture } from './CourtCaptureContext';
import './casting.css';

/** Native screen mirroring is separate from the optional local capture preview. */
export function CastingButton() {
  const { capture, available, rendering, state, stream, muted, error, includeAudio: capturedAudio } = useCourtCapture();
  const [open, setOpen] = useState(false);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [previewError, setPreviewError] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const titleId = useId();
  const active = state === 'capturing' || state === 'starting';

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    if (open) dialog.current?.showModal(); else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    const element = video.current;
    if (!open || !element || !stream) return;
    let cancelled = false;
    element.srcObject = stream;
    setPreviewError(false);
    void element.play().catch(() => { if (!cancelled) setPreviewError(true); });
    return () => { cancelled = true; element.pause(); element.srcObject = null; };
  }, [open, stream]);

  return <>
    <button className="icon-text-button" type="button" aria-label={active ? t("Casting · local capture active") : t("Casting")}
      aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <Cast size={18} /> <span>{t("Cast")}{active ? ' ·' : ''}</span>
    </button>
    {createPortal(<dialog className="casting-dialog" ref={dialog} aria-labelledby={titleId}
      onClose={() => setOpen(false)} onKeyDown={event => event.stopPropagation()}>
      <header><h2 id={titleId}>{t("Cast your court")}</h2><button type="button" aria-label={t("Close casting")} onClick={() => setOpen(false)}>{t("Close")}</button></header>
      {open ? <div className="casting-body">
        <section>
          <h3>{t("iPhone / iPad screen mirroring")}</h3>
          <p>{t("Use your device’s Screen Mirroring to show Tenmulate on a nearby TV or projector.")}</p>
          <ol>
            <li>{t("Connect your device and receiver to the same Wi-Fi network.")}</li>
            <li>{t("Open Control Center, tap")} <strong>{t("Screen Mirroring")}</strong>{t(", then choose your receiver.")}</li>
            <li>{t("Return to Tenmulate. Configure Quick Practice or a drill, then start practicing.")}</li>
          </ol>
          <p>{t("Look for your receiver’s name in the list.")}</p>
          <p className="casting-note">{t("This mirrors your device screen, including controls. Tenmulate cannot open that system picker or verify the connection. Keep this page visible and your device unlocked; resume practice if iOS pauses it.")}</p>
        </section>
        <section>
          <h3>{t("Local court capture")}</h3>
          <p>{t("Preview the court video captured inside this page. It continues across setup, Quick Practice and drills until you stop it. This preview does not connect to a receiver and is not needed for Screen Mirroring.")}</p>
          <p className="casting-note">{t("Only the court drawing is captured; menus, countdown text and other controls outside the canvas are excluded. Direct AirPlay of this live capture is unavailable in iOS Safari.")}</p>
          <div className="casting-status" role="status">{translateMessage(error) || (state === 'starting' ? t("Starting local capture…") : state === 'capturing'
            ? hidden || muted ? t("Local capture interrupted by the browser. Return to the court to continue.")
              : !rendering ? t("Court parked · capture retained. Open Practice, Editor or run a drill to resume.") : t("Local capture active · no receiver connection")
            : available ? t("Court ready for local capture") : t("Court capture unavailable or court still loading"))}</div>
          {stream ? <>
            <video ref={video} className="casting-preview" aria-label={t("Live court capture preview")} muted playsInline autoPlay disableRemotePlayback />
            {previewError ? <p role="alert">{t("The browser could not play the local preview. Close and reopen this panel to retry.")}</p> : null}
            <p className="casting-note">{t("Up to 30 frames per second · up to 720p · preview muted to avoid duplicate audio. Quality and frame delivery depend on your device.")}</p>
          </> : null}
          <div className="casting-actions">
            <label><input type="checkbox" checked={active ? capturedAudio : includeAudio} disabled={active} onChange={event => setIncludeAudio(event.target.checked)} /> {t("Include practice audio")}</label>
            {active ? <button type="button" onClick={capture.stop}>{t("Stop local capture")}</button>
              : <button type="button" disabled={!available} onClick={() => void capture.start(includeAudio)}>{t("Start local capture")}</button>}
          </div>
        </section>
      </div> : null}
    </dialog>, document.body)}
  </>;
}
