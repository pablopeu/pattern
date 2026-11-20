import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Native modal supplies inert background and a focus trap without another runtime. */
export function Modal({
  label,
  className = '',
  onClose,
  children,
}: {
  label: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      if (
        (previous instanceof HTMLElement || previous instanceof SVGElement) &&
        previous.isConnected
      )
        previous.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      aria-label={label}
      className={`studio-modal ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          close.current();
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close.current();
      }}
    >
      <div className="modal-content">{children}</div>
    </dialog>,
    document.body,
  );
}
