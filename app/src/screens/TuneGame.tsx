// Mochi's tune: Mochi sings a tune on four clouds, you sing it back by tapping them. Each round
// the tune grows by one note; one wrong note ends the game. Keys 1 to 4 work too. Free: no food
// used, no AI; the best score stays on this device.
import { useEffect, useRef, useState } from 'react';
import { usePet } from '../state';
import { playNote, play } from '../lib/sfx';
import { Mochi } from '../components/Mochi';
import type { Moment } from '../components/Mochi';
import { Button } from '../components/ui';
import { ArcadeBar, Asleep, loadBest, saveBest } from '../components/Arcade';

type Phase = 'ready' | 'mochi' | 'you' | 'over';

const PADS = [
  { name: 'Drop', className: 'tune-pad--rain', glyph: 'M0 -14 C7 -5 10 1 10 6 A10 10 0 0 1 -10 6 C-10 1 -7 -5 0 -14 Z' },
  { name: 'Sun', className: 'tune-pad--sun', glyph: 'M0 -12 L3 -4 L12 -4 L5 2 L8 11 L0 5 L-8 11 L-5 2 L-12 -4 L-3 -4 Z' },
  { name: 'Heart', className: 'tune-pad--heart', glyph: 'M0 10 C-14 0 -13 -12 -5 -12 C-2 -12 0 -10 0 -8 C0 -10 2 -12 5 -12 C13 -12 14 0 0 10 Z' },
  { name: 'Leaf', className: 'tune-pad--leaf', glyph: 'M-10 10 C-12 -4 -2 -12 12 -12 C12 2 4 12 -10 10 Z M-10 10 L4 -4' },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function TuneGame() {
  const pet = usePet();
  const [phase, setPhase] = useState<Phase>('ready');
  const [tune, setTune] = useState<number[]>([]);
  const [at, setAt] = useState(0);
  const [lit, setLit] = useState<number | null>(null);
  const [moment, setMoment] = useState<Moment>('none');
  const [best, setBest] = useState(() => loadBest('tune', pet));
  const [result, setResult] = useState<{ score: number; best: boolean; wrong: number; right: number } | null>(null);
  const alive = useRef(true);
  const busy = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function sing(notes: number[]) {
    setPhase('mochi');
    setAt(0);
    await wait(650);
    const noteMs = Math.max(240, 480 - notes.length * 18);
    for (const n of notes) {
      if (!alive.current) return;
      setLit(n);
      setMoment('talking');
      playNote(n, noteMs / 1000);
      await wait(noteMs);
      setLit(null);
      setMoment('none');
      await wait(150);
    }
    if (alive.current) setPhase('you');
  }

  function start() {
    const first = [Math.floor(Math.random() * 4)];
    setTune(first);
    setResult(null);
    void sing(first);
  }

  async function press(i: number) {
    if (phase !== 'you' || busy.current) return;
    playNote(i, 0.25);
    setLit(i);
    window.setTimeout(() => alive.current && setLit((l) => (l === i ? null : l)), 200);
    if (tune[at] !== i) {
      busy.current = true;
      play('oops');
      setMoment('giggling');
      const score = tune.length - 1;
      const newBest = saveBest('tune', pet, score);
      if (newBest) setBest(score);
      await wait(900);
      busy.current = false;
      if (!alive.current) return;
      setMoment('none');
      setResult({ score, best: newBest, wrong: i, right: tune[at] });
      setPhase('over');
      return;
    }
    if (at + 1 < tune.length) {
      setAt(at + 1);
      return;
    }
    // The whole tune, right: Mochi bounces and adds a note.
    busy.current = true;
    setMoment('playing');
    await wait(700);
    busy.current = false;
    if (!alive.current) return;
    setMoment('none');
    const next = [...tune, Math.floor(Math.random() * 4)];
    setTune(next);
    void sing(next);
  }

  // Keys 1 to 4 play the clouds.
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) pressRef.current(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (pet.hibernating) return <Asleep pet={pet} title="Mochi's tune" />;

  const status =
    phase === 'ready' ? `${pet.name} sings, you sing it back.`
      : phase === 'mochi' ? `${pet.name} is singing ${tune.length} ${tune.length === 1 ? 'note' : 'notes'}…`
        : phase === 'you' ? `Your turn: note ${at + 1} of ${tune.length}`
          : result && result.best ? `${result.score} ${result.score === 1 ? 'note' : 'notes'}, a new best!`
            : `${result?.score ?? 0} ${result?.score === 1 ? 'note' : 'notes'}`;

  return (
    <main className="screen screen--arcade">
      <ArcadeBar title={`${pet.name}'s tune`} />
      <h1 className="sr-only" tabIndex={-1}>
        {pet.name}'s tune
      </h1>
      <div className="arcade-stats">
        <span>
          Notes <b className="mono">{Math.max(0, tune.length - (phase === 'over' ? 1 : 0))}</b>
        </span>
        <span>
          Best <b className="mono">{best}</b>
        </span>
      </div>

      <div className="tune-stage">
        <Mochi stage={pet.stage} mood={pet.mood} moment={moment} size={150} name={pet.name} outfit={pet.outfit} />
      </div>
      <p className="voice-status" role="status">
        {status}
      </p>

      <div className="tune-pads" role="group" aria-label="Clouds">
        {PADS.map((p, i) => (
          <button
            key={p.name}
            type="button"
            className={`tune-pad ${p.className}${lit === i ? ' tune-pad--lit' : ''}`}
            aria-label={`${p.name} (${i + 1})`}
            aria-disabled={phase !== 'you'}
            onClick={() => void press(i)}
          >
            <svg viewBox="-16 -16 32 32" width="40" height="40" aria-hidden="true">
              <path d={p.glyph} fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>

      {phase === 'ready' || phase === 'over' ? (
        <div className="stack-10">
          {result ? (
            <p className="body-text center">
              {result.score >= 6
                ? '*twirls* You have a cloud\'s ear for music!'
                : `*giggles* That was the ${PADS[result.wrong].name.toLowerCase()}, not the ${PADS[result.right].name.toLowerCase()}. Again?`}
            </p>
          ) : null}
          <Button onClick={start}>{result ? 'Play again' : 'Start'}</Button>
        </div>
      ) : null}
    </main>
  );
}
