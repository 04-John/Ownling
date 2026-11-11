// 09 Give away: Mochi with a bow, what goes and what stays, the receiver field, the can't-undo
// warning, then an in-app confirm step with money details. Gifting moment until the screen closes.
import { useState, type FormEvent } from 'react';
import { useApp, usePet } from '../state';
import { navigate } from '../lib/router';
import { DASH, errorText, fmtNear, isAccountId, stageLabel } from '../lib/format';
import { Mochi } from '../components/Mochi';
import { MoneyDetails, TestnetNear } from '../components/MoneyDetails';
import { Sheet } from '../components/Sheet';
import { BackButton, Button, ErrorText } from '../components/ui';

export function Give() {
  const { client, account, setPet } = useApp();
  const pet = usePet();
  const [receiver, setReceiver] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [givenTo, setGivenTo] = useState<string | null>(null);
  const to = receiver.trim().toLowerCase();

  function review(e: FormEvent) {
    e.preventDefault();
    if (!isAccountId(to)) {
      setError('Enter their NEAR account, like friend.testnet.');
      return;
    }
    if (account && to === account.accountId) {
      setError(`That's your own account. ${pet.name} is already yours.`);
      return;
    }
    setError(null);
    setConfirmError(null);
    setConfirming(true);
  }

  async function give() {
    setBusy(true);
    setConfirmError(null);
    try {
      await client.give(to);
      setConfirming(false);
      setGivenTo(to);
    } catch (e) {
      setConfirmError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (givenTo) {
    return (
      <main className="screen">
        <div className="grow" />
        <div className="stack-6 center">
          <h1 className="title" tabIndex={-1}>
            {pet.name} lives with {givenTo} now
          </h1>
          <p className="sub">Its personality, growth and food went with it. Your diary stays with you.</p>
        </div>
        <div className="grow" />
        <Button
          onClick={() => {
            setPet(null);
            navigate('/adopt', { replace: true });
          }}
        >
          Adopt a cloudling
        </Button>
      </main>
    );
  }

  return (
    <main className="screen screen--give">
      <div className="topbar">
        <BackButton to="/ownership" />
      </div>
      <div className="give-head">
        <Mochi stage={pet.stage} mood={pet.mood} moment="gifting" size={120} name={pet.name} outfit={pet.outfit} />
        <div className="stack-4">
          <h1 className="title" tabIndex={-1}>
            Give {pet.name} to someone
          </h1>
          <div className="sub-sm">{pet.name} stays {pet.name}. Your talks stay yours.</div>
        </div>
      </div>

      <div className="two-cards">
        <section className="card card--small" aria-labelledby="goes">
          <h2 id="goes" className="mini-title mini-title--proof">
            Goes with {pet.name}
          </h2>
          <p className="mini-body">
            Personality
            <br />
            Growth · {stageLabel(pet.stage)}, {pet.growthPoints}
            <br />
            Food · <span className="mono small-mono">{fmtNear(pet.foodNear)} NEAR</span>
            <br />
            Outfits
          </p>
        </section>
        <section className="card card--small" aria-labelledby="stays">
          <h2 id="stays" className="mini-title mini-title--muted">
            Stays with you
          </h2>
          <p className="mini-body">The diary. {pet.name} won't remember your conversations; the new owner starts fresh.</p>
        </section>
      </div>

      <form className="stack-flex" onSubmit={review} noValidate>
        <div className="field">
          <label htmlFor="to" className="field__label">
            Their NEAR account
          </label>
          <input
            id="to"
            className="input input--mono"
            placeholder="friend.testnet"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
          />
        </div>
        <div className="warn">This can't be undone. Only the new owner can give {pet.name} back.</div>
        <div className="grow" />
        <ErrorText>{error}</ErrorText>
        <Button type="submit">Give {pet.name}</Button>
        <p className="footnote">The app asks you to confirm.</p>
      </form>

      {confirming ? (
        <Sheet title={`Give ${pet.name} to ${to}`} onClose={() => setConfirming(false)} closeLabel="Cancel" busy={busy}>
          <MoneyDetails
            rows={[
              { label: 'From', value: account?.accountId ?? DASH, mono: true },
              { label: 'To', value: to, mono: true },
              { label: 'Pet', value: <>{pet.name} <span className="mono">· pet #{pet.tokenId}</span></> },
              { label: 'Food goes too', value: <TestnetNear amount={pet.foodNear} /> },
              { label: 'Diary', value: 'Stays with you', strong: true },
            ]}
          />
          <p className="note">This can't be undone. Only {to} can give {pet.name} back.</p>
          <ErrorText>{confirmError}</ErrorText>
          <Button onClick={give} busy={busy} busyLabel="Giving…">
            Give {pet.name}
          </Button>
        </Sheet>
      ) : null}
    </main>
  );
}
