// 06 Hibernating: replaces Home when food runs out. Wake up feeds 0.1 NEAR, then Home plays waking.
import { useState } from 'react';
import { useApp, usePet } from '../state';
import { errorText } from '../lib/format';
import { Mochi } from '../components/Mochi';
import { MoodLine } from '../components/MoodLine';
import { RunwayMeter } from '../components/RunwayMeter';
import { IconLock } from '../components/Icons';
import { Button, ErrorText } from '../components/ui';

export const WAKE_FEED_NEAR = 0.1;

export function Hibernating() {
  const { client, setPet, setCelebration } = useApp();
  const pet = usePet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function wake() {
    setBusy(true);
    setError(null);
    try {
      const next = await client.feed(WAKE_FEED_NEAR);
      setCelebration({ kind: 'wake' });
      setPet(next);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <main className="screen screen--sleep">
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
        </div>
      </header>

      <div className="stage stage--home">
        <Mochi stage={pet.stage} mood="hibernating" size={270} name={pet.name} />
      </div>

      <RunwayMeter name={pet.name} days={pet.runwayDays} mood="hibernating">
        <p className="runway__body">
          Nothing is lost. Its memory, growth and personality are kept while it sleeps. Feeding wakes it.
        </p>
      </RunwayMeter>

      <ErrorText>{error}</ErrorText>
      <Button className="btn--tall" onClick={wake} busy={busy} busyLabel="Waking up…">
        Wake up
      </Button>
      <p className="footnote">
        Wake up feeds <span className="mono ink">0.1 testnet NEAR</span> to {pet.name}'s food budget.
      </p>
    </main>
  );
}
