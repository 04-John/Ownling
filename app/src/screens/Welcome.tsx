// 01 Welcome: logo, baby Mochi floating, the ownership promise. No wallet: "Create my account"
// makes a key in this browser; "I already have Mochi" restores from a recovery phrase.
import { useState } from 'react';
import { useApp } from '../state';
import { navigate } from '../lib/router';
import { errorText } from '../lib/format';
import { Mochi } from '../components/Mochi';
import { LogoMark } from '../components/Icons';
import { Button, ErrorText } from '../components/ui';

export function Welcome() {
  const { client, setAccount, setFreshPhrase } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const { account, recoveryPhrase } = await client.createAccount();
      setFreshPhrase(recoveryPhrase);
      setAccount(account);
      navigate('/recovery');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen screen--welcome">
      <div className="brand">
        <LogoMark size={30} />
        <span className="brand__word">ownling</span>
      </div>
      <div className="stage">
        <Mochi stage="baby" mood="content" size={250} />
      </div>
      <div className="welcome__copy">
        <h1 className="display" tabIndex={-1}>
          A pet that owns itself.
        </h1>
        <p className="lede">
          You own Mochi, and Mochi keeps its own memory and food. If this app ever shuts down, Mochi wakes up somewhere
          else, still yours.
        </p>
      </div>
      <div className="stack-10">
        <ErrorText>{error}</ErrorText>
        <Button onClick={create} busy={busy} busyLabel="Creating your account…">
          Create my account
        </Button>
        <a className="btn btn--secondary" href="#/restore" aria-disabled={busy || undefined}>
          I already have Mochi
        </a>
        <p className="footnote">No wallet needed. You get a recovery phrase: keep it, and Mochi is yours anywhere.</p>
      </div>
    </main>
  );
}
