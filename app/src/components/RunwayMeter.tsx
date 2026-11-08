// "Mochi can think for 23 more days" plus a bar that fills to 30 days. Fill color follows mood.
import { useEffect, useState, type ReactNode } from 'react';
import type { Mood } from '../lib/types';
import { capitalize, runwayPhrase } from '../lib/format';

const FULL_DAYS = 30;

function fillPercent(days: number | null, mood: Mood): number {
  if (mood === 'hibernating' || days == null || !(days > 0)) return 0;
  // Keep a visible stub for the last day so "1 more day" still shows a sliver of storm.
  return Math.max(3, Math.min(100, (days / FULL_DAYS) * 100));
}

type Props = {
  name: string;
  days: number | null;
  mood: Mood;
  /** Animate the bar from this value (after feeding). */
  fromDays?: number | null;
  children?: ReactNode;
};

export function RunwayMeter({ name, days, mood, fromDays, children }: Props) {
  const title = mood === 'hibernating' ? `${capitalize(name)} can't afford a thought` : `${name} ${runwayPhrase(days)}`;
  const [shownDays, setShownDays] = useState(fromDays !== undefined ? fromDays : days);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShownDays(days));
    return () => cancelAnimationFrame(id);
  }, [days]);

  return (
    <section className={`card runway runway--${mood}`} aria-label="Food">
      <h2 className="runway__title">{title}</h2>
      <div className="runway__track" aria-hidden="true">
        <div className="runway__fill" style={{ width: `${fillPercent(shownDays, mood)}%` }} />
      </div>
      {children}
    </section>
  );
}
