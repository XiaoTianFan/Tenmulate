import { t } from '../i18n/locale';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalProps = Readonly<{
  title: string;
  children: ReactNode;
  onClose?: () => void;
  actions?: ReactNode;
  labelledBy?: string;
}>;

export function Modal({ title, children, onClose, actions, labelledBy = 'modal-title' }: ModalProps) {
  const root = useRef<HTMLElement>(null), close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const items = () => [...root.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
    items()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if ([...document.querySelectorAll('[role="dialog"]')].at(-1) !== root.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current?.(); }
      if (event.key !== 'Tab') return;
      const elements = items(), first = elements[0], last = elements.at(-1);
      if (!root.current?.contains(document.activeElement) || event.shiftKey && document.activeElement === first) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('keydown', key, true); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={root} className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <header>
          <h2 id={labelledBy}>{title}</h2>
          {onClose ? <button type="button" aria-label={t("Close dialog")} onClick={onClose}><X size={19} /></button> : null}
        </header>
        <div className="modal-body">{children}</div>
        {actions ? <footer className="modal-actions">{actions}</footer> : null}
      </section>
    </div>
  );
}
