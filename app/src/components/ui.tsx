// Small shared pieces: back button, inline error, busy-aware button.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { IconBack } from './Icons';

export function BackButton({ to, variant = 'circle' }: { to: string; variant?: 'circle' | 'plain' | 'proof' }) {
  return (
    <a className={`icon-button icon-button--${variant}`} href={`#${to}`} aria-label="Back">
      <IconBack />
    </a>
  );
}

/** Shows a thrown Error.message next to the action that failed. */
export function ErrorText({ children, id }: { children: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p className="error" role="alert" id={id}>
      {children}
    </p>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'proof';
  busy?: boolean;
  busyLabel?: string;
};

export function Button({ variant = 'primary', busy, busyLabel, children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={['btn', `btn--${variant}`, className].filter(Boolean).join(' ')}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}
