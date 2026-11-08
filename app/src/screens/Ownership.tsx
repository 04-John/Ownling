// 08 Who controls Mochi: proof style. Limits first, what we can and can't do, mono facts, and the
// Change kitchen action with an in-app confirm step.
import { useState, type FormEvent } from 'react';
import { useApp, usePet } from '../state';
import { DASH, errorText, fmtNear, isAccountId, modelLabel } from '../lib/format';
import { MoneyDetails, TestnetNear } from '../components/MoneyDetails';
import { Sheet } from '../components/Sheet';
import { BackButton, Button, ErrorText } from '../components/ui';

export function Ownership() {
  const { client, account } = useApp();
  const pet = usePet();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const hasPhrase = client.recoveryPhrase() != null;

  return (
    <main className="screen screen--proof">
      <div className="proof-topbar">
        <BackButton to="/home" variant="proof" />
        <span className="eyebrow">OWNERSHIP · PET #{pet.tokenId}</span>
        {hasPhrase ? (
          <a className="proof-link" href="#/recovery?from=ownership">
            Show recovery phrase
          </a>
        ) : null}
      </div>
      <div className="stack-6">
        <h1 className="proof-title" tabIndex={-1}>
          What we can and can't do with {pet.name}
        </h1>
        <p className="proof-sub">Limits first. Each line is enforced by {pet.name}'s contract, not by our policy.</p>
      </div>

      <section className="proof-card" aria-labelledby="can-do">
        <h2 id="can-do" className="proof-card__title">
          What we can do
        </h2>
        <ul className="can-list">
          <li>
            <span className="dot dot--peckish" aria-hidden="true" />
            See a message in memory for a moment, before it goes to NEAR AI. Moving that step into your browser is planned.
          </li>
          <li>
            <span className="dot dot--accent" aria-hidden="true" />
            Charge {pet.name} per reply, up to your daily cap, with a receipt each time.
          </li>
          <li>
            <span className="dot dot--accent" aria-hidden="true" />
            Stop running this app. {pet.name} wakes in any other client.
          </li>
        </ul>
      </section>

      <section className="proof-card" aria-labelledby="cant-do">
        <h2 id="cant-do" className="proof-card__title">
          What we can't do
        </h2>
        <ul className="cant-grid">
          <li>Read the diary</li>
          <li>Change its personality</li>
          <li>Spend past your cap</li>
          <li>Take {pet.name} from you</li>
          <li>Switch {pet.name} off</li>
          <li>Store your chats</li>
        </ul>
      </section>

      <dl className="facts" aria-label="Facts read from NEAR">
        <dt>contract</dt>
        <dd>{pet.contractId || client.config.contractId || DASH}</dd>
        <dt>kitchen</dt>
        <dd>{pet.kitchen || DASH}</dd>
        <dt>model</dt>
        <dd>{modelLabel(pet.model)}</dd>
        <dt>daily cap</dt>
        <dd>{pet.dailyCapNear > 0 ? `${fmtNear(pet.dailyCapNear)} NEAR` : DASH}</dd>
        <dt>admin keys</dt>
        <dd>{DASH}</dd>
      </dl>

      <div className="grow" />
      {done ? (
        <p className="proof-status" role="status">
          {done}
        </p>
      ) : null}
      <div className="two-up">
        <a className="btn btn--proof-secondary" href="#/give">
          Give away
        </a>
        <button type="button" className="btn btn--proof" onClick={() => setConfirming(true)}>
          Change kitchen
        </button>
      </div>
      <p className="proof-foot">Changing the kitchen or the cap asks you to confirm.</p>

      {confirming ? (
        <ChangeKitchenSheet
          accountId={account?.accountId ?? null}
          onClose={() => setConfirming(false)}
          onDone={(kitchen) => {
            setConfirming(false);
            setDone(`Kitchen changed. Only ${kitchen} can charge ${pet.name} now.`);
          }}
        />
      ) : null}
    </main>
  );
}

function ChangeKitchenSheet({
  accountId,
  onClose,
  onDone,
}: {
  accountId: string | null;
  onClose: () => void;
  onDone: (kitchen: string) => void;
}) {
  const { client, setPet } = useApp();
  const pet = usePet();
  const [kitchen, setKitchen] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = kitchen.trim().toLowerCase();

  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!isAccountId(next)) {
      setError('Enter a NEAR account, like kitchen.testnet.');
      return;
    }
    if (next === pet.kitchen) {
      setError(`${next} is already ${pet.name}'s kitchen.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setPet(await client.changeKitchen(next));
      onDone(next);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Sheet title="Change kitchen" onClose={onClose} closeLabel="Cancel" proof busy={busy}>
      <form className="stack-14" onSubmit={confirm} noValidate>
        <p className="proof-sub proof-sub--sm">
          The kitchen cooks {pet.name}'s replies and is the only account that can charge its food, never past your daily
          cap. Pick another one and {pet.name}'s food pays it from now on.
        </p>
        <div className="field">
          <label htmlFor="kitchen" className="field__label">
            New kitchen account
          </label>
          <input
            id="kitchen"
            className="input input--mono input--proof"
            placeholder="kitchen.testnet"
            value={kitchen}
            onChange={(e) => setKitchen(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
          />
        </div>
        <MoneyDetails
          rows={[
            { label: 'From', value: accountId ?? DASH, mono: true },
            { label: 'To', value: <span className="mono">{pet.contractId || client.config.contractId}</span> },
            { label: 'Kitchen now', value: pet.kitchen || DASH, mono: true },
            { label: 'New kitchen', value: next || DASH, mono: true },
            { label: 'Daily cap', value: <TestnetNear amount={pet.dailyCapNear} /> },
          ]}
        />
        <ErrorText>{error}</ErrorText>
        <Button variant="proof" type="submit" busy={busy} busyLabel="Changing…">
          Change kitchen
        </Button>
      </form>
    </Sheet>
  );
}
