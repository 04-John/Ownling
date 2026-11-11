// Wardrobe: Mochi in what it's trying on, then Hats, Scarves and Things to hold. Tap an item to try
// it on (one per slot); locked items say how to earn them (win games for bond, or grow up). "Wear
// this" saves the outfit on chain, where it travels with the NFT and shows in the wallet picture.
import { useState } from 'react';
import { ITEMS, SLOTS, isUnlocked, itemPreviewSvg, unlockText, type Item } from '../../../shared/wardrobe';
import { useApp, usePet } from '../state';
import { errorText } from '../lib/format';
import { Mochi } from '../components/Mochi';
import { BackButton, Button, ErrorText } from '../components/ui';

export function Wardrobe() {
  const { client, setPet } = useApp();
  const pet = usePet();
  const [trying, setTrying] = useState<string[]>(pet.outfit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const changed = trying.join(',') !== pet.outfit.join(',');
  const unlocked = ITEMS.filter((i) => isUnlocked(i, pet)).length;

  function toggle(item: Item) {
    setSaved(false);
    setTrying((now) =>
      now.includes(item.id)
        ? now.filter((id) => id !== item.id)
        : [...now.filter((id) => ITEMS.find((i) => i.id === id)?.slot !== item.slot), item.id],
    );
  }

  async function wear() {
    setBusy(true);
    setError(null);
    try {
      setPet(await client.dress(trying));
      setSaved(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen screen--wardrobe">
      <div className="topbar">
        <BackButton to="/home" />
        <span className="small-mono muted">
          {unlocked} of {ITEMS.length} unlocked
        </span>
      </div>
      <div className="stack-6">
        <h1 className="title-lg" tabIndex={-1}>
          {pet.name}'s wardrobe
        </h1>
        <p className="sub">Win games and grow up to unlock more. What {pet.name} wears is saved with it on NEAR.</p>
      </div>

      <div className="wardrobe-stage">
        <Mochi stage={pet.stage} mood={pet.mood} size={190} name={pet.name} outfit={trying} />
      </div>

      {pet.stage === 'egg' ? <p className="note center">{pet.name} can dress up once it hatches.</p> : null}

      {SLOTS.map(({ slot, title }) => (
        <section key={slot} className="stack-6" aria-labelledby={`slot-${slot}`}>
          <h2 id={`slot-${slot}`} className="section-label">
            {title}
          </h2>
          <div className="wardrobe-grid">
            {ITEMS.filter((i) => i.slot === slot).map((item) => {
              const open = isUnlocked(item, pet);
              const on = trying.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={['wardrobe-item', on ? 'wardrobe-item--on' : '', open ? '' : 'wardrobe-item--locked'].join(' ')}
                  onClick={() => open && toggle(item)}
                  aria-pressed={on}
                  aria-disabled={!open}
                >
                  <span className="wardrobe-item__art" dangerouslySetInnerHTML={{ __html: itemPreviewSvg(item, 44) }} />
                  <span className="wardrobe-item__name">{item.name}</span>
                  <span className="wardrobe-item__note">{open ? (on ? 'Wearing' : 'Tap to try') : unlockText(item, pet.name)}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <div className="stack-10 wardrobe-actions">
        <ErrorText>{error}</ErrorText>
        {saved && !changed ? <p className="note center">Saved on NEAR. It shows in your wallet too.</p> : null}
        <Button onClick={wear} disabled={!changed} busy={busy} busyLabel="Saving…">
          {trying.length || !changed ? 'Wear this' : 'Take everything off'}
        </Button>
      </div>
    </main>
  );
}
