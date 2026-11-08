// Bottom sheet: radius 28 on top, 40×5 grab handle, scrim. A modal dialog: Escape closes, focus
// stays inside while open and returns to where it was on close. `above` renders undimmed over the
// scrim (the Feed sheet shows Mochi there).
import { useEffect, useId, useRef, type ReactNode } from 'react';

type Props = {
  title: string;
  onClose: () => void;
  closeLabel?: string;
  above?: ReactNode;
  /** Proof-style sheet (ownership page) instead of the game style. */
  proof?: boolean;
  /** Block closing while a transaction is in flight. */
  busy?: boolean;
  children: ReactNode;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

export function Sheet({ title, onClose, closeLabel = 'Close', above, proof, busy, children }: Props) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === 'Tab' && ref.current) {
        const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      before?.focus?.();
    };
  }, []);

  return (
    <div className="sheet-layer">
      <div className="sheet-scrim" onClick={() => !busy && onClose()} aria-hidden="true" />
      {above ? <div className="sheet-above">{above}</div> : <div className="sheet-spacer" />}
      <div
        ref={ref}
        className={proof ? 'sheet sheet--proof' : 'sheet'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="sheet__handle" aria-hidden="true" />
        <div className="sheet__head">
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
          <button type="button" className="text-button" onClick={onClose} disabled={busy}>
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
