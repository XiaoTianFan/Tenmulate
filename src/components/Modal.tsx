import type { ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalProps = Readonly<{
  title: string;
  children: ReactNode;
  onClose?: () => void;
  actions?: ReactNode;
  labelledBy?: string;
}>;

export function Modal({ title, children, onClose, actions, labelledBy = 'modal-title' }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <header>
          <h2 id={labelledBy}>{title}</h2>
          {onClose ? <button type="button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button> : null}
        </header>
        <div className="modal-body">{children}</div>
        {actions ? <footer className="modal-actions">{actions}</footer> : null}
      </section>
    </div>
  );
}
