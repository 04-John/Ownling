// Get the app: one card per kind of device, each with a button and three plain steps. Android and
// Windows download a file; iPhone, iPad and Mac install the website from the browser.
import { useEffect, useState } from 'react';
import { useApp } from '../state';
import { DOWNLOADS, isAppleMobile, runningInstalled } from '../lib/platform';
import { BackButton, Button } from '../components/ui';

/** Chromium's install prompt, which browsers fire when the website can be installed. */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function Download() {
  const { account } = useApp();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(runningInstalled);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    if ((await prompt.userChoice).outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  }

  const apple = isAppleMobile();

  return (
    <main className="screen screen--download">
      <div className="topbar">
        <BackButton to={account ? '/home' : '/'} />
        <span className="topbar__spacer" />
      </div>
      <div className="stack-6">
        <h1 className="title-lg" tabIndex={-1}>
          Get Ownling
        </h1>
        <p className="sub">
          The same Mochi on every device. To move between devices, sign in with your recovery phrase.
        </p>
      </div>

      <section className="card download-card" aria-labelledby="dl-android">
        <div className="download-card__head">
          <h2 id="dl-android" className="download-card__title">
            Android phone
          </h2>
          <span className="mono small-mono muted">5 MB</span>
        </div>
        <a className="btn btn--primary" href={DOWNLOADS.android}>
          Download for Android
        </a>
        <ol className="download-steps">
          <li>Open the file when it finishes downloading.</li>
          <li>If Android asks, allow your browser to install apps.</li>
          <li>
            Tap <b>Install</b>, then <b>Open</b>.
          </li>
        </ol>
      </section>

      <section className="card download-card" aria-labelledby="dl-windows">
        <div className="download-card__head">
          <h2 id="dl-windows" className="download-card__title">
            Windows computer
          </h2>
          <span className="mono small-mono muted">113 MB</span>
        </div>
        <a className="btn btn--primary" href={DOWNLOADS.windows}>
          Download for Windows
        </a>
        <ol className="download-steps">
          <li>Open the file when it finishes downloading.</li>
          <li>
            If Windows says it protected your PC, choose <b>More info</b>, then <b>Run anyway</b>.
          </li>
          <li>Ownling opens. Next time, find it in the Start menu.</li>
        </ol>
      </section>

      <section className="card download-card" aria-labelledby="dl-other">
        <h2 id="dl-other" className="download-card__title">
          iPhone, iPad, Mac or another computer
        </h2>
        {installed ? (
          <p className="body-text">Ownling is installed on this device.</p>
        ) : prompt ? (
          <Button onClick={install}>Install Ownling</Button>
        ) : null}
        <ol className="download-steps">
          {apple ? (
            <>
              <li>Open ownling.onrender.com in Safari.</li>
              <li>
                Tap <b>Share</b>, then <b>Add to Home Screen</b>.
              </li>
              <li>
                Tap <b>Add</b>. Ownling appears with your other apps.
              </li>
            </>
          ) : (
            <>
              <li>Open ownling.onrender.com in Chrome, Edge or Safari.</li>
              <li>
                In Chrome or Edge, choose <b>Install</b> in the address bar. In Safari on a Mac, choose <b>File</b>, then{' '}
                <b>Add to Dock</b>. On an iPhone, tap <b>Share</b>, then <b>Add to Home Screen</b>.
              </li>
              <li>Ownling opens in its own window.</li>
            </>
          )}
        </ol>
      </section>

      <p className="footnote">
        These are testnet builds. They aren't signed by Google or Microsoft yet, which is why your device asks you to
        confirm.
      </p>
    </main>
  );
}
