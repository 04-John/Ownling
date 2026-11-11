// 03 Home (or 06 Hibernating when the pet sleeps). Mochi 270 px, its greeting or last line in a
// bubble (tap to reply), progress to the next stage, runway meter, Feed / Play / Talk. Plays
// thinking, talking, eating, growing and waking moments.
import { useEffect, useMemo, useState } from 'react';
import { useApp, usePet } from '../state';
import { errorText, fmtNear, growthProgress } from '../lib/format';
import { prefersReducedMotion, useMomentSequence } from '../lib/hooks';
import type { Moment } from '../components/Mochi';
import type { PetState, Stage } from '../lib/types';
import { Mochi } from '../components/Mochi';
import { Bubble } from '../components/Bubble';
import { MoodLine } from '../components/MoodLine';
import { RunwayMeter } from '../components/RunwayMeter';
import { ActionTiles } from '../components/ActionTiles';
import { IconHanger, IconLock, IconShield, RainDrop } from '../components/Icons';
import { ErrorText } from '../components/ui';
import { Hibernating } from './Hibernating';

export function HomeRoute() {
  const pet = usePet();
  return pet.hibernating ? <Hibernating /> : <Home />;
}

/** Greet once per app start, so Mochi speaks first when you open it, not each time you come back. */
let greetedThisSession = false;

/** Mochi's own voice: at most two short sentences, small actions in asterisks. */
function lineFor(pet: PetState, moment: Moment, lastReply: string | null, grewTo: Stage | null): string {
  if (moment === 'eating') return '*gulps the rain* Mmm. Thank you.';
  if (moment === 'waking') return '*blinks awake* Oh. You came back for me.';
  if (grewTo === 'baby') return '*hatches* Oh. Hello. Are you my person?';
  if (grewTo) return `*glows* I grew. I'm a ${grewTo} now.`;
  if (moment === 'thinking') return '*stirs*';
  if (pet.stage === 'egg') return '*wobbles gently*';
  if (lastReply) return lastReply;
  if (pet.mood === 'hungry') return '*droops a little* I could really use some rain.';
  if (pet.mood === 'peckish') return '*sniffs the air* Is that rain I smell?';
  return '*floats closer* You came back.';
}

export function Home() {
  const { client, setPet, reloadPet, celebration, setCelebration } = useApp();
  const pet = usePet();
  const { step, run } = useMomentSequence();
  const [error, setError] = useState<string | null>(null);
  const [fromDays, setFromDays] = useState<number | null | undefined>(undefined);
  const [greeting, setGreeting] = useState<'waiting' | string | null>(null);
  const [grewTo, setGrewTo] = useState<Stage | null>(null);

  // Refresh on open: the kitchen may have charged Mochi since we last looked.
  useEffect(() => {
    reloadPet({ silent: true }).catch((e) => setError(`${pet.name}'s latest state didn't load: ${errorText(e)}`));
  }, [reloadPet]);

  // Mochi speaks first, about something it remembers. An egg hatches with its first words.
  useEffect(() => {
    if (greetedThisSession || pet.hibernating) return;
    greetedThisSession = true;
    setGreeting('waiting');
    client
      .greet((text) => setGreeting(text))
      .then(({ reply, pet: next }) => {
        setGreeting(reply.content);
        setPet(next);
        run([{ moment: 'talking', ms: 2200 }]);
      })
      .catch(() => setGreeting(null));
  }, [client, pet.hibernating, run, setPet]);

  // Play the moment Feed, Wake up or growing up asked for.
  useEffect(() => {
    if (!celebration) return;
    if (celebration.kind === 'eat') {
      setFromDays(celebration.fromDays);
      run(prefersReducedMotion() ? [{ moment: 'eating', ms: 1500 }] : [{ moment: 'none', ms: 900, drops: true }, { moment: 'eating', ms: 1500 }]);
    } else if (celebration.kind === 'grow') {
      setGrewTo(celebration.stage);
      run([{ moment: 'playing', ms: 2500 }]);
    } else {
      run([{ moment: 'waking', ms: 3000 }]);
    }
    setCelebration(null);
  }, [celebration, run, setCelebration]);

  const moment: Moment = step?.moment ?? (greeting === 'waiting' ? 'thinking' : 'none');

  const lastReply = useMemo(() => {
    if (greeting && greeting !== 'waiting') return greeting;
    const turns = client.history();
    for (let i = turns.length - 1; i >= 0; i--) if (turns[i].role === 'assistant') return turns[i].content;
    return null;
  }, [client, greeting]);
  const growth = growthProgress(pet.growthPoints, pet.name);

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
          <a className="icon-button icon-button--circle" href="#/wardrobe" aria-label={`${pet.name}'s wardrobe`}>
            <IconHanger />
          </a>
          <a className="icon-button icon-button--circle" href="#/diary" aria-label={`${pet.name}'s diary`}>
            <IconLock />
          </a>
          <a className="icon-button icon-button--circle" href="#/ownership" aria-label={`Who controls ${pet.name}`}>
            <IconShield />
          </a>
        </div>
      </header>

      <div className="growth">
        <span className="growth__track" aria-hidden="true">
          <span className="growth__fill" style={{ width: `${Math.round(growth.progress * 100)}%` }} />
        </span>
        <span className="growth__text">{growth.text}</span>
      </div>

      <a className="bubble-link" href="#/talk" aria-live="polite" aria-label={`${pet.name} says: ${lineFor(pet, moment, lastReply, grewTo)}. Reply`}>
        <Bubble from="mochi" text={lineFor(pet, moment, lastReply, grewTo)} speaker={pet.name} className="bubble--home" />
      </a>

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
        <Mochi stage={pet.stage} mood={pet.mood} moment={moment} size={270} name={pet.name} outfit={pet.outfit} />
      </div>

      <RunwayMeter name={pet.name} days={pet.runwayDays} mood={pet.mood} fromDays={fromDays}>
        <div className="runway__meta">
          <span>Food</span>
          <span className="mono">{fmtNear(pet.foodNear)} testnet NEAR</span>
        </div>
        <p className="runway__note">Each reply uses a little food. Counted at the full daily cap.</p>
      </RunwayMeter>

      <ErrorText>{error}</ErrorText>
      <ActionTiles feedHref="#/feed" playHref="#/play" talkHref="#/talk" />
    </main>
  );
}
