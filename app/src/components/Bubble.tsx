// Chat bubbles: you on the right in rain, Mochi on the left on paper or puddle. Small actions in
// asterisks (*wiggles happily*) render in italics.
import type { ReactNode } from 'react';

export function withActions(text: string): ReactNode[] {
  return text.split(/(\*[^*\n]+\*)/g).map((part, i) => (/^\*[^*\n]+\*$/.test(part) ? <i key={i}>{part}</i> : part));
}

type Props = {
  from: 'you' | 'mochi';
  text: string;
  tone?: 'paper' | 'puddle';
  /** Spoken prefix for screen readers, e.g. "Mochi said". */
  speaker?: string;
  className?: string;
};

export function Bubble({ from, text, tone = 'paper', speaker, className }: Props) {
  const cls = ['bubble', `bubble--${from}`, from === 'mochi' && `bubble--${tone}`, className].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      {speaker ? <span className="sr-only">{speaker}: </span> : null}
      {withActions(text)}
    </div>
  );
}
