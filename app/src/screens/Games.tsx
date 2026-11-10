// Play: bottom sheet over a dimmed home, like Feed. Three games, each a short round of chat with
// Mochi. Winning a round adds a bond point on chain (at most one every 10 minutes), and every
// reply counts toward growing up.
import { GAMES, type GameId } from '../../../shared/mind';
import { useApp, usePet } from '../state';
import { navigate } from '../lib/router';
import { fmtCountdown } from '../lib/format';
import { useNow } from '../lib/hooks';
import { Mochi } from '../components/Mochi';
import { Sheet } from '../components/Sheet';

const ORDER: GameId[] = ['riddle', 'guess', 'rather'];

export function Games() {
  const { client } = useApp();
  const pet = usePet();
  const close = () => navigate('/home', { replace: true });
  const now = useNow(pet.playReadyAt ? 1000 : null);
  const bondIn = pet.playReadyAt && pet.playReadyAt > now ? pet.playReadyAt - now : null;
  const asleep = pet.hibernating;

  return (
    <div className="screen screen--backdrop">
      <Sheet title={`Play with ${pet.name}`} onClose={close} above={<Mochi stage={pet.stage} mood={pet.mood} moment="playing" size={190} name={pet.name} />}>
        {asleep ? (
          <p className="body-text">
            {pet.name} is hibernating. Feed it first, then you can play.
          </p>
        ) : (
          <ul className="games" aria-label="Games">
            {ORDER.map((id) => (
              <li key={id}>
                <button type="button" className="game-card" onClick={() => navigate(`/talk?game=${id}`, { replace: true })}>
                  <span className="game-card__title">{GAMES[id].title}</span>
                  <span className="game-card__blurb">{GAMES[id].blurb}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="note">
          Win a round and your bond with {pet.name} grows.
          {bondIn ? ` Next bond point in ${fmtCountdown(bondIn)}.` : ''} Every reply also counts toward growing up
          {client.config.practiceMode ? '. In practice mode, the questions come from a short fixed list.' : '.'}
        </p>
      </Sheet>
    </div>
  );
}
