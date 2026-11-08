// 07 Diary: lock status, the key explanation, what Mochi remembers, storage size, Lock / Unlock.
import { useEffect, useState } from 'react';
import { useApp, usePet } from '../state';
import { dayLabel, errorText, fmtBytes, shortDate } from '../lib/format';
import type { DiaryView } from '../lib/types';
import { IconLock, IconLockOpen } from '../components/Icons';
import { BackButton, Button, ErrorText } from '../components/ui';

export function Diary() {
  const { client } = useApp();
  const pet = usePet();
  const [view, setView] = useState<DiaryView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    client
      .diary()
      .then((v) => live && setView(v))
      .catch((e) => live && setLoadError(errorText(e)));
    return () => {
      live = false;
    };
  }, [client]);

  async function unlock() {
    setBusy(true);
    setError(null);
    try {
      setView(await client.unlockDiary());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    setError(null);
    try {
      client.lockDiary();
      setView(await client.diary());
    } catch (e) {
      setError(errorText(e));
    }
  }

  const locked = view?.locked ?? true;
  const updated = view?.updatedAt ? new Date(view.updatedAt) : null;

  return (
    <main className="screen screen--diary">
      <div className="topbar">
        <BackButton to="/home" />
        <span className="status-chip">
          <span className={`dot ${view == null ? 'dot--unknown' : locked ? 'dot--hibernating' : 'dot--content'}`} aria-hidden="true" />
          {view == null ? '—' : locked ? 'Locked' : 'Unlocked in this browser'}
        </span>
      </div>

      <div className="diary-title">
        <div className="diary-title__icon">{locked ? <IconLock size={30} /> : <IconLockOpen size={30} />}</div>
        <div className="stack-2">
          <h1 className="title" tabIndex={-1}>
            {pet.name}'s diary
          </h1>
          <div className="sub-sm">What {pet.name} remembers about you</div>
        </div>
      </div>

      <div className="card card--text">
        The key is made from your account's signature, on your device. We never see it, so we can't read this. If {pet.name}{' '}
        changes hands, the new owner starts with an empty diary.
      </div>

      <div className="diary-list">
        {loadError ? <ErrorText>{loadError}</ErrorText> : null}
        {view && !view.locked ? (
          view.facts.length || view.recent.length ? (
            <>
              {view.facts.length ? (
                <ul className="entries" aria-label={`What ${pet.name} remembers`}>
                  {view.facts.map((f, i) => (
                    <li key={i} className="entry">
                      <span className="entry__text">{f}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {view.recent.length ? (
                <>
                  <h2 className="section-label">Recent talks</h2>
                  <ul className="entries" aria-label="Recent talks">
                    {view.recent.map((t, i) => (
                      <li key={i} className="entry">
                        <span className="entry__date mono">{t.at ? dayLabel(t.at) : '—'}</span>
                        <span className="entry__text">
                          <span className="entry__who">{t.role === 'user' ? 'You' : pet.name}: </span>
                          {t.content}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          ) : (
            <p className="card card--text muted">Nothing yet. {pet.name} starts remembering after your first talk.</p>
          )
        ) : null}
        {view?.locked ? (
          <p className="card card--text muted">
            Locked. Unlocking rebuilds the key from your account's signature in this browser, then shows what {pet.name}{' '}
            remembers.
          </p>
        ) : null}
        <p className="diary-foot">
          Memory costs food: the diary's storage is paid from {pet.name}'s budget.{' '}
          <span className="mono ink">{fmtBytes(view?.sizeBytes)}</span>
          {updated && !Number.isNaN(updated.getTime()) ? <> · Last written {shortDate(updated)}</> : null}
        </p>
      </div>

      <ErrorText>{error}</ErrorText>
      {locked ? (
        <Button onClick={unlock} busy={busy} busyLabel="Unlocking…" disabled={view == null}>
          Unlock
        </Button>
      ) : (
        <Button variant="secondary" onClick={lock}>
          Lock
        </Button>
      )}
    </main>
  );
}
