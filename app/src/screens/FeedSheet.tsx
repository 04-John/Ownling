// 05 Feed: bottom sheet over a dimmed home. Drizzle / Shower / Storm, money details, the
// "food stays with Mochi" note, and one button that names the amount. Shows what the player's
// account holds; portions it can't pay for (food plus the network fee held back) are greyed out.
import { useEffect, useState } from 'react';
import { useApp, usePet } from '../state';
import { navigate, useRoute } from '../lib/router';
import { atLeastDays, errorText, fmtNear, portionDays } from '../lib/format';
import { FEED_FEE_NEAR } from '../lib/client';
import { Mochi } from '../components/Mochi';
import { Sheet } from '../components/Sheet';
import { MoneyDetails, TestnetNear } from '../components/MoneyDetails';
import { RainDrop } from '../components/Icons';
import { Button, ErrorText } from '../components/ui';

export const PORTIONS = [
  { id: 'drizzle', label: 'Drizzle', near: 0.02, drop: 16 },
  { id: 'shower', label: 'Shower', near: 0.1, drop: 22 },
  { id: 'storm', label: 'Storm', near: 0.5, drop: 28 },
] as const;
type PortionId = (typeof PORTIONS)[number]['id'];

const FAUCET = 'https://docs.near.org/getting-started/faucet';
/** Balances to three places, rounded down, so 0.018 never shows as 0.02. */
const fmtBalance = (n: number) => (Math.floor(n * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '') || '0';

export function FeedSheet() {
  const { client, account, setPet, setCelebration } = useApp();
  const pet = usePet();
  // Asking Mochi for "a storm" opens the sheet as #/feed?portion=storm.
  const asked = PORTIONS.find((p) => p.id === useRoute().query.get('portion'));
  const [choice, setChoice] = useState<PortionId>(asked?.id ?? 'shower');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const portion = PORTIONS.find((p) => p.id === choice) ?? PORTIONS[1];
  const close = () => navigate('/home', { replace: true });
  const affordable = (near: number) => balance == null || near + FEED_FEE_NEAR <= balance;
  const canFeedAny = PORTIONS.some((p) => affordable(p.near));

  useEffect(() => {
    let live = true;
    client
      .balance()
      .then((b) => {
        if (!live) return;
        setBalance(b);
        if (b == null) return;
        const fits = (near: number) => near + FEED_FEE_NEAR <= b;
        // Keep the portion asked for if the account can pay for it; otherwise start on the biggest
        // portion up to Shower that it can.
        if (asked && fits(asked.near)) return;
        setChoice(!fits(0.1) && fits(0.02) ? 'drizzle' : 'shower');
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [client]);

  async function feed() {
    setBusy(true);
    setError(null);
    const wasAsleep = pet.hibernating;
    const fromDays = pet.runwayDays;
    try {
      const next = await client.feed(portion.near);
      setCelebration(wasAsleep ? { kind: 'wake' } : { kind: 'eat', fromDays });
      setPet(next);
      close();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
      client.balance().then(setBalance).catch(() => undefined);
    }
  }

  return (
    <div className="screen screen--backdrop">
      <Sheet
        title={`Feed ${pet.name}`}
        onClose={close}
        busy={busy}
        above={<Mochi stage={pet.stage} mood={pet.mood} size={210} name={pet.name} outfit={pet.outfit} />}
      >
        <fieldset className="portions">
          <legend className="sr-only">Portion</legend>
          {PORTIONS.map((p) => {
            const ok = affordable(p.near);
            return (
              <label key={p.id} className={['portion', p.id === choice && 'portion--on', !ok && 'portion--off'].filter(Boolean).join(' ')}>
                <input
                  type="radio"
                  name="portion"
                  className="sr-only"
                  value={p.id}
                  checked={p.id === choice}
                  onChange={() => setChoice(p.id)}
                  disabled={busy || !ok}
                />
                <RainDrop size={p.drop} />
                <span className="portion__name">{p.label}</span>
                <span className="portion__days">{ok ? portionDays(p.near, pet.dailyCapNear) : 'Not enough NEAR'}</span>
                <span className="portion__near mono">{fmtNear(p.near)} NEAR</span>
              </label>
            );
          })}
        </fieldset>

        <MoneyDetails
          rows={[
            { label: 'From', value: account?.accountId ?? '—', mono: true },
            { label: 'You have', value: <span className="mono">{balance == null ? '—' : `${fmtBalance(balance)} testnet NEAR`}</span> },
            {
              label: 'To',
              value: (
                <>
                  {pet.name}'s food budget <span className="mono">· pet #{pet.tokenId}</span>
                </>
              ),
            },
            { label: 'Amount', value: <TestnetNear amount={portion.near} /> },
            { label: 'Daily cap', value: <TestnetNear amount={pet.dailyCapNear} /> },
            { label: 'After', value: atLeastDays(pet.foodNear, portion.near, pet.dailyCapNear), strong: true },
          ]}
        />

        {canFeedAny ? (
          <p className="note">
            Days are counted at the full daily cap, so light chatting lasts longer. Food stays with {pet.name}: only its
            kitchen can spend it, with a receipt for every reply. You can't take it back out. Feeding also needs about{' '}
            {fmtNear(FEED_FEE_NEAR)} NEAR held for the network fee; most of it comes back.
          </p>
        ) : (
          <p className="warn">
            Your account has {fmtBalance(balance ?? 0)} testnet NEAR, not enough to feed {pet.name}: even a Drizzle needs
            about {fmtNear(0.02 + FEED_FEE_NEAR)} with the network fee. Testnet NEAR is free:{' '}
            <a href={FAUCET} target="_blank" rel="noopener noreferrer">
              get some from NEAR's faucet
            </a>{' '}
            for <span className="mono">{account?.accountId}</span>, then come back.
          </p>
        )}
        <ErrorText>{error}</ErrorText>
        <Button onClick={feed} busy={busy} busyLabel="Feeding…" disabled={!affordable(portion.near)}>
          Feed {fmtNear(portion.near)} NEAR
        </Button>
      </Sheet>
    </div>
  );
}
