import { useCallback, useEffect, useRef, useState } from 'react';
import type { Moment } from '../../../design/mochi/mochi';

/** Date.now(), refreshed every `intervalMs` while it is not null. */
export function useNow(intervalMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (intervalMs == null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export type MomentStep = { moment: Moment; ms: number; drops?: boolean };

/** Plays a sequence of Mochi moments (eating for 1.5 s, playing for 2 s, …), then back to none. */
export function useMomentSequence() {
  const [step, setStep] = useState<MomentStep | null>(null);
  const timers = useRef<number[]>([]);
  const cancel = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setStep(null);
  }, []);
  const run = useCallback(
    (steps: MomentStep[]) => {
      cancel();
      let at = 0;
      steps.forEach((s, i) => {
        if (i === 0) setStep(s);
        else timers.current.push(window.setTimeout(() => setStep(s), at));
        at += s.ms;
      });
      timers.current.push(window.setTimeout(() => setStep(null), at));
    },
    [cancel],
  );
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  return { step, run, cancel };
}
