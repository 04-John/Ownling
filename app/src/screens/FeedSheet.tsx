// 05 Feed: bottom sheet over a dimmed home. Drizzle / Shower / Storm, money details, the
// "food stays with Mochi" note, and one button that names the amount.
import { useState } from 'react';
import { useApp, usePet } from '../state';
import { navigate } from '../lib/router';
import { atLeastDays, errorText, fmtNear, portionDays } from '../lib/format';
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

export function FeedSheet() {
  const { client, account, setPet, setCelebration } = useApp();
  const pet = usePet();
  const [choice, setChoice] = useState<PortionId>('shower');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portion = PORTIONS.find((p) => p.id === choice) ?? PORTIONS[1];
  const close = () => navigate('/home', { replace: true });

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
          {PORTIONS.map((p) => (
            <label key={p.id} className={p.id === choice ? 'portion portion--on' : 'portion'}>
              <input
                type="radio"
                name="portion"
                className="sr-only"
                value={p.id}
                checked={p.id === choice}
                onChange={() => setChoice(p.id)}
                disabled={busy}
              />
              <RainDrop size={p.drop} />
              <span className="portion__name">{p.label}</span>
              <span className="portion__days">{portionDays(p.near, pet.dailyCapNear)}</span>
              <span className="portion__near mono">{fmtNear(p.near)} NEAR</span>
            </label>
          ))}
        </fieldset>

        <MoneyDetails
          rows={[
            { label: 'From', value: account?.accountId ?? '—', mono: true },
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

        <p className="note">
          Days are counted at the full daily cap, so light chatting lasts longer. Food stays with {pet.name}: only its
          kitchen can spend it, with a receipt for every reply. You can't take it back out.
        </p>
        <ErrorText>{error}</ErrorText>
        <Button onClick={feed} busy={busy} busyLabel="Feeding…">
          Feed {fmtNear(portion.near)} NEAR
        </Button>
      </Sheet>
    </div>
  );
}
