// Restore: sign in on this device with the 12-word recovery phrase.
import { useState, type FormEvent } from 'react';
import { useApp } from '../state';
import { navigate } from '../lib/router';
import { errorText } from '../lib/format';
import { BackButton, Button, ErrorText } from '../components/ui';

const words = (s: string) => s.trim().toLowerCase().split(/\s+/).filter(Boolean);

export function Restore() {
  const { client, setAccount, setPet } = useApp();
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = words(phrase).length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const list = words(phrase);
    if (list.length !== 12) {
      setError(`A recovery phrase has 12 words. You entered ${list.length}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const account = await client.restore(list.join(' '));
      const pet = await client.myPet();
      setAccount(account);
      setPet(pet);
      navigate(pet ? '/home' : '/adopt', { replace: true });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <main className="screen screen--form">
      <div className="topbar">
        <BackButton to="/" />
      </div>
      <div className="stack-6">
        <h1 className="title-lg" tabIndex={-1}>
          Welcome back.
        </h1>
        <p className="sub">Enter the 12 words you saved, in order. This signs you in on this device.</p>
      </div>
      <form className="stack-flex" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="phrase" className="field__label">
            Recovery phrase
          </label>
          <textarea
            id="phrase"
            className="input input--mono textarea"
            rows={4}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="12 words, separated by spaces"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="phrase-count"
            aria-invalid={error ? true : undefined}
          />
          <span id="phrase-count" className="field__hint">
            {count} of 12 words
          </span>
        </div>
        <div className="grow" />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" busy={busy} busyLabel="Signing in…">
          Sign in
        </Button>
        <p className="footnote">Lost the phrase? No one can get Mochi back for you, including us.</p>
      </form>
    </main>
  );
}
