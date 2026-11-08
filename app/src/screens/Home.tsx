// 03 Home (or 06 Hibernating when the pet sleeps). Mochi 270 px, last line in a bubble, runway
// meter, Feed / Play / Talk. Plays eating, playing, resting and waking moments.
import { useEffect, useMemo, useState } from 'react';
import { useApp, usePet } from '../state';
import { errorText, fmtNear, growthLine } from '../lib/format';
import { prefersReducedMotion, useMomentSequence, useNow } from '../lib/hooks';
import type { Moment } from '../components/Mochi';
import type { PetState } from '../lib/types';
import { Mochi } from '../components/Mochi';
import { Bubble } from '../components/Bubble';
import { MoodLine } from '../components/MoodLine';
import { RunwayMeter } from '../components/RunwayMeter';
import { ActionTiles } from '../components/ActionTiles';
import { IconLock, IconShield, RainDrop } from '../components/Icons';
import { ErrorText } from '../components/ui';
import { Hibernating } from './Hibernating';

export function HomeRoute() {
  const pet = usePet();
  return pet.hibernating ? <Hibernating /> : <Home />;
}

/** Mochi's own voice: at most two short sentences, small actions in asterisks. */
function lineFor(pet: PetState, moment: Moment, lastReply: string | null): string {
  if (moment === 'eating') return '*gulps the rain* Mmm. Thank you.';
  if (moment === 'waking') return '*blinks awake* Oh. You came back for me.';
  if (moment === 'playing') return '*bounces around* Again, again.';
  if (pet.stage === 'egg') return '*wobbles gently*';
  if (moment === 'resting') return '*catches its breath* That was fun.';
  if (lastReply) return lastReply;
  if (pet.mood === 'hungry') return '*droops a little* I could really use some rain.';
  if (pet.mood === 'peckish') return '*sniffs the air* Is that rain I smell?';
  return '*floats closer* You came back.';
}

export function Home() {
  const { client, setPet, reloadPet, celebration, setCelebration } = useApp();
  const pet = usePet();
  const { step, run, cancel } = useMomentSequence();
  const [playBusy, setPlayBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDays, setFromDays] = useState<number | null | undefined>(undefined);

  // Refresh on open: the kitchen may have charged Mochi since we last looked.
  useEffect(() => {
    reloadPet({ silent: true }).catch((e) => setError(`${pet.name}'s latest state didn't load: ${errorText(e)}`));
  }, [reloadPet]);

  // Play the moment Feed or Wake up asked for.
  useEffect(() => {
    if (!celebration) return;
    if (celebration.kind === 'eat') {
      setFromDays(celebration.fromDays);
      run(prefersReducedMotion() ? [{ moment: 'eating', ms: 1500 }] : [{ moment: 'none', ms: 900, drops: true }, { moment: 'eating', ms: 1500 }]);
    } else {
      run([{ moment: 'waking', ms: 3000 }]);
    }
    setCelebration(null);
  }, [celebration, run, setCelebration]);

  const now = useNow(pet.playReadyAt ? 1000 : null);
  const restLeftMs = pet.playReadyAt && pet.playReadyAt > now ? pet.playReadyAt - now : null;
  const moment: Moment = step?.moment ?? (restLeftMs ? 'resting' : 'none');

  const lastReply = useMemo(() => {
    const turns = client.history();
    for (let i = turns.length - 1; i >= 0; i--) if (turns[i].role === 'assistant') return turns[i].content;
    return null;
  }, [client]);

  async function play() {
    setPlayBusy(true);
    setError(null);
    run([{ moment: 'playing', ms: 2000 }]);
    try {
      setPet(await client.play());
    } catch (e) {
      cancel();
      setError(errorText(e));
    } finally {
      setPlayBusy(false);
    }
  }

  return (
    <main className="screen screen--home">
      <header className="pet-head">
        <div className="pet-head__id">
          <h1 className="pet-name" tabIndex={-1}>
            {pet.name}
          </h1>
          <MoodLine mood={pet.mood} stage={pet.stage} />
        </div>
        <div className="pet-head__actions">
          <a className="icon-button icon-button--circle" href="#/diary" aria-label={`${pet.name}'s diary`}>
            <IconLock />
          </a>
          <a className="icon-button icon-button--circle" href="#/ownership" aria-label={`Who controls ${pet.name}`}>
            <IconShield />
          </a>
        </div>
      </header>

      <div aria-live="polite">
        <Bubble from="mochi" text={lineFor(pet, moment, lastReply)} speaker={pet.name} className="bubble--home" />
      </div>

      <div className="stage stage--home">
        {step?.drops ? (
          <div className="rain-fall" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="rain-fall__drop" style={{ left: `${38 + i * 6}%`, animationDelay: `${i * 90}ms` }}>
                <RainDrop size={18} />
              </span>
            ))}
          </div>
        ) : null}
        <Mochi stage={pet.stage} mood={pet.mood} moment={moment} size={270} name={pet.name} />
      </div>

      <RunwayMeter name={pet.name} days={pet.runwayDays} mood={pet.mood} fromDays={fromDays}>
        <div className="runway__meta">
          <span>{growthLine(pet.growthPoints)}</span>
          <span className="mono">{fmtNear(pet.foodNear)} testnet NEAR</span>
        </div>
        <p className="runway__note">Counted at the full daily cap. Light chatting lasts longer.</p>
      </RunwayMeter>

      <ErrorText>{error}</ErrorText>
      <ActionTiles feedHref="#/feed" talkHref="#/talk" onPlay={play} playBusy={playBusy} restLeftMs={restLeftMs} />
    </main>
  );
}
