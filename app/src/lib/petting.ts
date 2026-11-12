// Touching Mochi on Home: pat its head, tickle its tummy, stroke it, hold it for a hug. Poke it
// too fast and it gets dizzy; keep going and it sulks under a tiny storm. All on the device: no
// AI, no food used, nothing sent.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Moment } from '../../../design/mochi/mochi';
import type { PetState } from './types';
import { buzz, play, type Sound } from './sfx';

type Kind = 'pat' | 'tickle' | 'stroke' | 'hug' | 'dizzy' | 'grumpy';

const LINES: Record<Kind, string[]> = {
  pat: ['*leans into your hand*', '*closes its eyes* Again?', '*glows a little* I like that.', '*bobs happily*'],
  tickle: ['*giggles* Hee! That tickles!', '*squeaks* Not the tummy!', '*wiggles* Hehe, stop, stop… no, keep going.'],
  stroke: ['*rumbles like a happy little thunder*', '*goes all soft and fluffy*', '*hums* Mmm, more of that.'],
  hug: ['*squishes into your hand* Warm.', "*holds on* Don't let go yet.", '*melts a little* This is nice.'],
  dizzy: ['*spins* Whoa… so many fingers…', "*wobbles* Everything's going round."],
  grumpy: ['*puffs up a tiny storm* Hey! Gentle, please.', "*turns away* Hmph. That's enough poking."],
};

const EGG_LINES: Record<Kind, string[]> = {
  pat: ['*wobbles* Someone is knocking!', '*taps back from inside*'],
  tickle: ['*rocks side to side*', '*a tiny giggle from inside the shell*'],
  stroke: ['*the shell feels warm*', '*hums softly inside*'],
  hug: ['*snuggles into your hands*'],
  dizzy: ['*rolls in a little circle*'],
  grumpy: ['*goes very still* …Gently, please.'],
};

const REACTION: Record<Kind, { moment: Moment; ms: number; sound: Sound; buzz?: number }> = {
  pat: { moment: 'loved', ms: 1600, sound: 'boop' },
  tickle: { moment: 'giggling', ms: 1500, sound: 'giggle', buzz: 10 },
  stroke: { moment: 'loved', ms: 1400, sound: 'hum' },
  hug: { moment: 'loved', ms: 2400, sound: 'hum', buzz: 25 },
  dizzy: { moment: 'dizzy', ms: 2400, sound: 'dizzy', buzz: 40 },
  grumpy: { moment: 'grumpy', ms: 3200, sound: 'hmph', buzz: 60 },
};

const HINT_KEY = 'ownling.petted.v1';
/** This much finger travel turns a press into a stroke. */
const STROKE_PX = 45;
const HOLD_MS = 550;

export type Reaction = { moment: Moment; line: string };

function pick(list: string[], last: string | null): string {
  const options = list.length > 1 ? list.filter((l) => l !== last) : list;
  return options[Math.floor(Math.random() * options.length)];
}

export function usePetting(pet: PetState) {
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [hint, setHint] = useState(() => {
    try {
      return !localStorage.getItem(HINT_KEY);
    } catch {
      return false;
    }
  });
  const press = useRef<{ x: number; y: number; travel: number; stroked: boolean; held: boolean } | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const endTimer = useRef<number | undefined>(undefined);
  const taps = useRef<number[]>([]);
  const sulkUntil = useRef(0);
  const lastLine = useRef<string | null>(null);
  const humAt = useRef(0);

  useEffect(
    () => () => {
      window.clearTimeout(holdTimer.current);
      window.clearTimeout(endTimer.current);
    },
    [],
  );

  const react = useCallback(
    (kind: Kind) => {
      const r = REACTION[kind];
      const lines = pet.stage === 'egg' ? EGG_LINES[kind] : LINES[kind];
      let line = pick(lines, lastLine.current);
      if (pet.mood === 'hungry' && pet.stage !== 'egg' && (kind === 'pat' || kind === 'hug') && Math.random() < 0.5) {
        line = "*leans in weakly* I'm a little hungry, though.";
      }
      // A long stroke keeps its line and hums now and then, instead of every few pixels.
      if (kind === 'stroke' && reaction?.moment === 'loved') line = reaction.line;
      lastLine.current = line;
      const now = performance.now();
      if (kind !== 'stroke' || now - humAt.current > 1100) {
        if (kind === 'stroke') humAt.current = now;
        play(r.sound);
        if (r.buzz) buzz(r.buzz);
      }
      setReaction({ moment: r.moment, line });
      window.clearTimeout(endTimer.current);
      endTimer.current = window.setTimeout(() => setReaction(null), r.ms);
      if (kind === 'grumpy') sulkUntil.current = now + r.ms;
      if (hint) {
        setHint(false);
        try {
          localStorage.setItem(HINT_KEY, '1');
        } catch {
          /* fine */
        }
      }
    },
    [pet.stage, pet.mood, reaction, hint],
  );

  /** A tap: pat on the head, tickle lower down; too many, too fast, and Mochi gets dizzy, then grumpy. */
  const tap = useCallback(
    (zone: 'head' | 'tummy') => {
      const now = performance.now();
      if (now < sulkUntil.current) return;
      taps.current = [...taps.current.filter((t) => now - t < 4000), now];
      const recent = taps.current.filter((t) => now - t < 1600).length;
      if (taps.current.length >= 12) {
        taps.current = [];
        react('grumpy');
      } else if (recent >= 6) react('dizzy');
      else react(zone === 'head' ? 'pat' : 'tickle');
    },
    [react],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      press.current = { x: e.clientX, y: e.clientY, travel: 0, stroked: false, held: false };
      window.clearTimeout(holdTimer.current);
      holdTimer.current = window.setTimeout(() => {
        const p = press.current;
        if (p && !p.stroked && p.travel < 12 && performance.now() >= sulkUntil.current) {
          p.held = true;
          react('hug');
        }
      }, HOLD_MS);
    },
    [react],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const p = press.current;
      if (!p) return;
      p.travel += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y);
      p.x = e.clientX;
      p.y = e.clientY;
      if (p.travel > STROKE_PX && !p.held && performance.now() >= sulkUntil.current) {
        p.stroked = true;
        p.travel = 0;
        window.clearTimeout(holdTimer.current);
        react('stroke');
      }
    },
    [react],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const p = press.current;
      press.current = null;
      window.clearTimeout(holdTimer.current);
      if (!p || p.stroked || p.held) return;
      const box = e.currentTarget.getBoundingClientRect();
      tap((e.clientY - box.top) / box.height < 0.55 ? 'head' : 'tummy');
    },
    [tap],
  );

  const onPointerCancel = useCallback(() => {
    press.current = null;
    window.clearTimeout(holdTimer.current);
  }, []);

  /** Keyboard: Enter or Space pats, T tickles, H hugs. */
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tap('head');
      } else if (e.key === 't' || e.key === 'T') tap('tummy');
      else if (e.key === 'h' || e.key === 'H') react('hug');
    },
    [tap, react],
  );

  return { reaction, hint, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown } };
}
