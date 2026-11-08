// Recovery phrase: shown right after createAccount() (step 1 of 2) and again from ownership.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state';
import { navigate } from '../lib/router';
import { Button, BackButton, ErrorText } from '../components/ui';
import { IconCopy } from '../components/Icons';

export function Recovery({ fromOwnership }: { fromOwnership: boolean }) {
  const { client, account, pet, freshPhrase, setFreshPhrase } = useApp();
  const phrase = freshPhrase ?? client.recoveryPhrase();
  const list = phrase ? phrase.trim().split(/\s+/) : [];
  const name = pet?.name ?? 'Mochi';
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    if (!phrase) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(phrase);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError('This browser blocked copying. Select the words and copy them yourself.');
    }
  }

  function done() {
    if (fromOwnership) {
      navigate('/ownership');
    } else {
      setFreshPhrase(null);
      navigate(pet ? '/home' : '/adopt');
    }
  }

  return (
    <main className="screen screen--form">
      <div className="topbar">
        {fromOwnership ? <BackButton to="/ownership" /> : <span className="topbar__spacer" />}
        {fromOwnership ? null : <span className="step">Step 1 of 2</span>}
        <span className="topbar__spacer" />
      </div>
      <div className="stack-6">
        <h1 className="title-lg" tabIndex={-1}>
          Your recovery phrase
        </h1>
        <p className="sub">
          This phrase is your key to {name}. It works in any NEAR wallet and on the wake page. Anyone who has it owns{' '}
          {name}.
        </p>
      </div>

      {phrase ? (
        <>
          <section className="card phrase-card" aria-label="Recovery phrase, 12 words">
            <ol className="phrase-grid" style={{ gridTemplateRows: `repeat(${Math.ceil(list.length / 2)}, auto)` }}>
              {list.map((w, i) => (
                <li key={i}>
                  <span className="phrase-grid__n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="phrase-grid__w">{w}</span>
                </li>
              ))}
            </ol>
            {account ? (
              <div className="phrase-card__account">
                <span>Account</span>
                <span className="mono">{account.accountId}</span>
              </div>
            ) : null}
          </section>
          <p className="note">
            Write it down or keep it in a password manager. If you lose it and this browser forgets you, no one can get{' '}
            {name} back for you, including us.
          </p>
          <div className="grow" />
          <ErrorText>{copyError}</ErrorText>
          <Button variant="secondary" onClick={copy}>
            <IconCopy size={18} />
            {copied ? 'Copied' : 'Copy phrase'}
          </Button>
          <span className="sr-only" role="status">
            {copied ? 'Recovery phrase copied' : ''}
          </span>
          <Button onClick={done}>I saved it</Button>
          {fromOwnership ? null : <p className="footnote">You can see it again on Who controls {name}.</p>}
        </>
      ) : (
        <>
          <section className="card">
            <p className="body-text">There's no phrase to show here. This account signs in with a NEAR wallet, and the wallet holds its key.</p>
          </section>
          <div className="grow" />
          <Button onClick={done}>{fromOwnership ? 'Back' : 'Next'}</Button>
        </>
      )}
    </main>
  );
}
