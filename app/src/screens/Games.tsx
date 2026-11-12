// Play: bottom sheet over a dimmed home, like Feed. Quick games (Catch the rain, Mochi's tune) and
// Echo run on the device: free, no food, no AI. The talk games are short rounds of chat with
// Mochi: winning one adds a bond point on chain (at most one every 10 minutes), and every reply
// counts toward growing up.
import { useState } from 'react';
import { GAMES, type GameId } from '../../../shared/mind';
import { useApp, usePet } from '../state';
import { navigate } from '../lib/router';
import { fmtCountdown } from '../lib/format';
import { useNow } from '../lib/hooks';
import { setSoundOn, soundOn } from '../lib/sfx';
import { Sheet } from '../components/Sheet';

const ORDER: GameId[] = ['riddle', 'guess', 'rather'];

export function Games() {
  const { client } = useApp();
  const pet = usePet();
  const close = () => navigate('/home', { replace: true });
  const now = useNow(pet.playReadyAt ? 1000 : null);
  const bondIn = pet.playReadyAt && pet.playReadyAt > now ? pet.playReadyAt - now : null;
  const asleep = pet.hibernating;
  const [sound, setSound] = useState(soundOn);

  const quick = [
    { href: '/rain', title: 'Catch the rain', blurb: `Move ${pet.name} to catch raindrops. Dodge the soot!` },
    { href: '/tune', title: `${pet.name}'s tune`, blurb: `${pet.name} sings a tune, you sing it back. It gets longer every round.` },
    { href: '/echo', title: 'Echo', blurb: `Say anything, and ${pet.name} says it back in a funny voice.` },
  ];

  return (
    <div className="screen screen--backdrop">
      <Sheet title={`Play with ${pet.name}`} onClose={close}>
        {asleep ? (
          <p className="body-text">
            {pet.name} is hibernating. Feed it first, then you can play.
          </p>
        ) : (
          <>
            <section className="stack-10" aria-labelledby="quick-games">
              <h3 className="games-head" id="quick-games">
                Quick games
              </h3>
              <ul className="games" aria-label="Quick games">
                {quick.map((g) => (
                  <li key={g.href}>
                    <button type="button" className="game-card" onClick={() => navigate(g.href, { replace: true })}>
                      <span className="game-card__title">{g.title}</span>
                      <span className="game-card__blurb">{g.blurb}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="note">Free: these use no food and stay on this device.</p>
            </section>

            <section className="stack-10" aria-labelledby="talk-games">
              <h3 className="games-head" id="talk-games">
                Talk games
              </h3>
              <ul className="games" aria-label="Talk games">
                {ORDER.map((id) => (
                  <li key={id}>
                    <button type="button" className="game-card" onClick={() => navigate(`/talk?game=${id}`, { replace: true })}>
                      <span className="game-card__title">{GAMES[id].title}</span>
                      <span className="game-card__blurb">{GAMES[id].blurb}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="note">
                Played in chat with {pet.name}'s NEAR AI mind. Win a round and your bond with {pet.name} grows on chain.
                {bondIn ? ` Next bond point in ${fmtCountdown(bondIn)}.` : ''} Every reply also counts toward growing up
                {client.config.practiceMode ? '. In practice mode, the questions come from a short fixed list.' : '.'}
              </p>
            </section>
          </>
        )}
        <button
          type="button"
          className="btn btn--secondary voice-choice"
          aria-pressed={sound}
          onClick={() => {
            setSoundOn(!sound);
            setSound(!sound);
          }}
        >
          {sound ? 'Sounds: on' : 'Sounds: off'}
        </button>
      </Sheet>
    </div>
  );
}
