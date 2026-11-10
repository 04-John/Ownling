// 01 Welcome: what Ownling is in three short steps (an AI friend that remembers you, food is its
// thinking, it belongs to you), then the two ways in. No wallet: "Create my account" makes a key in
// this browser; "I already have Mochi" restores from a recovery phrase. Someone who has seen the
// steps before starts on the last one.
import { useState } from 'react';
import { useApp } from '../state';
import { navigate } from '../lib/router';
import { errorText } from '../lib/format';
import type { Moment } from '../components/Mochi';
import type { Mood } from '../lib/types';
import { Mochi } from '../components/Mochi';
import { LogoMark } from '../components/Icons';
import { Button, ErrorText } from '../components/ui';
import { TARGET, runningInstalled } from '../lib/platform';

const SEEN_KEY = 'ownling.intro.v1';

const STEPS: { title: string; text: string; mood: Mood; moment: Moment }[] = [
  {
    title: 'Meet Mochi, an AI friend that remembers you.',
    text: 'Tell Mochi about your day. It remembers what you share, asks how things went, plays games with you, and grows up the more you talk.',
    mood: 'content',
    moment: 'talking',
  },
  {
    title: 'Every thought costs a little food.',
    text: 'Mochi thinks with real AI, and each reply uses a tiny bit of its food. Feed it to keep it thinking. If the food runs out, Mochi falls asleep until you come back. It never dies.',
    mood: 'peckish',
    moment: 'eating',
  },
  {
    title: 'Mochi is yours, not ours.',
    text: "Mochi, its memory and its food live on NEAR, a public network, not on our servers. No one can change Mochi, read its diary or take it from you. If Ownling ever shuts down, Mochi wakes up somewhere else.",
    mood: 'content',
    moment: 'verified',
  },
];

function seenBefore(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function Welcome() {
  const { client, setAccount, setFreshPhrase } = useApp();
  const [step, setStep] = useState(() => (seenBefore() ? STEPS.length - 1 : 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];

  function goTo(to: number) {
    setStep(to);
    if (to === STEPS.length - 1) {
      try {
        localStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* private window: show the steps again next time */
      }
    }
    document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
  }

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
      <div className="topbar">
        <div className="brand">
          <LogoMark size={30} />
          <span className="brand__word">ownling</span>
        </div>
        {!last ? (
          <button type="button" className="text-button" onClick={() => goTo(STEPS.length - 1)}>
            Skip
          </button>
        ) : null}
      </div>
      <div className="stage">
        <Mochi key={step} stage="baby" mood={s.mood} moment={s.moment} size={230} />
      </div>
      <div className="welcome__copy">
        <h1 className="display display--intro" tabIndex={-1}>
          {s.title}
        </h1>
        <p className="lede">{s.text}</p>
        <div className="intro-dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? 'intro-dot intro-dot--on' : 'intro-dot'} />
          ))}
        </div>
      </div>
      {last ? (
        <div className="stack-10">
          <ErrorText>{error}</ErrorText>
          <Button onClick={create} busy={busy} busyLabel="Creating your account…">
            Create my account
          </Button>
          <a className="btn btn--secondary" href="#/restore" aria-disabled={busy || undefined}>
            I already have Mochi
          </a>
          <p className="footnote">No wallet needed. Your account starts with free test food and a recovery phrase: keep it, and Mochi is yours anywhere.</p>
          {TARGET === 'web' && !runningInstalled() ? (
            <a className="text-button" href="#/download">
              Get the app for Android, Windows or iPhone
            </a>
          ) : null}
        </div>
      ) : (
        <div className="stack-10">
          <Button onClick={() => goTo(step + 1)}>Next</Button>
          {step === 0 ? (
            <a className="btn btn--secondary" href="#/restore">
              I already have Mochi
            </a>
          ) : (
            <Button variant="secondary" onClick={() => goTo(step - 1)}>
              Back
            </Button>
          )}
        </div>
      )}
    </main>
  );
}
