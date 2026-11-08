// 02 Adopt: egg, name field, starter food card. The deposit pays storage (about 0.01 NEAR) and the
// rest becomes Mochi's food.
import { useState, type FormEvent } from 'react';
import { useApp } from '../state';
import { navigate } from '../lib/router';
import { errorText, fmtNear, wholeDays } from '../lib/format';
import { Mochi } from '../components/Mochi';
import { BackButton, Button, ErrorText } from '../components/ui';

const DEPOSIT_NEAR = 0.5;
const STARTER_FOOD_NEAR = 0.49; // deposit minus about 0.01 storage
const DEFAULT_CAP_NEAR = 0.02;
const MAX_NAME = 24;

function nameProblem(name: string): string | null {
  if (!name) return 'Give your cloudling a name.';
  if (name.length > MAX_NAME) return `Names can be up to ${MAX_NAME} characters.`;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '’-]*$/u.test(name)) return 'Use letters, numbers, spaces, hyphens or apostrophes.';
  return null;
}

export function Adopt() {
  const { client, setPet } = useApp();
  const [name, setName] = useState('Mochi');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim().replace(/\s+/g, ' ');
  const shown = trimmed || 'Mochi';
  const days = wholeDays(STARTER_FOOD_NEAR / DEFAULT_CAP_NEAR);

  async function adopt(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const problem = nameProblem(trimmed);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const pet = await client.adopt(trimmed, DEPOSIT_NEAR);
      setPet(pet);
      navigate('/home', { replace: true });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <main className="screen screen--adopt">
      <div className="topbar">
        <BackButton to="/recovery" />
        <span className="step">Step 2 of 2</span>
        <span className="topbar__spacer" />
      </div>
      <div className="stack-6">
        <h1 className="title-lg" tabIndex={-1}>
          Meet your cloudling.
        </h1>
        <p className="sub">It hatches when you say its first word.</p>
      </div>
      <div className="egg-card">
        <Mochi stage="egg" mood="content" size={210} name={shown} />
      </div>
      <form className="stack-flex adopt__form" onSubmit={adopt} noValidate>
        <div className="field">
          <label htmlFor="petname" className="field__label">
            Name
          </label>
          <input
            id="petname"
            className="input input--name"
            value={name}
            maxLength={MAX_NAME + 8}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
          />
        </div>
        <section className="food-card" aria-label="Starter food">
          <div className="food-card__head">
            <span className="food-card__title">Starter food</span>
            <span className="mono food-card__amount">{fmtNear(STARTER_FOOD_NEAR)} testnet NEAR</span>
          </div>
          <p className="food-card__text">
            Goes to {shown}'s own food budget, not to us. Its kitchen can spend up to{' '}
            <span className="mono ink">{fmtNear(DEFAULT_CAP_NEAR)}</span> a day, with a receipt for each reply. At least{' '}
            {days} days of thinking.
          </p>
        </section>
        <div className="grow" />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" busy={busy} busyLabel="Adopting…">
          {trimmed ? `Adopt ${trimmed}` : 'Adopt'}
        </Button>
        <p className="footnote">Adoption and diary storage use about 0.01 testnet NEAR.</p>
      </form>
    </main>
  );
}
