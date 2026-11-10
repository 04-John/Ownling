// Feed / Play / Talk. Only Talk is filled. Play opens the games sheet.
import { IconChat, IconDrop, IconSparkle } from './Icons';

type Props = { feedHref: string; playHref: string; talkHref: string };

export function ActionTiles({ feedHref, playHref, talkHref }: Props) {
  return (
    <nav className="tiles" aria-label="Actions">
      <a className="tile" href={feedHref}>
        <IconDrop className="tile__icon" />
        Feed
      </a>
      <a className="tile" href={playHref}>
        <IconSparkle className="tile__icon" />
        Play
      </a>
      <a className="tile tile--primary" href={talkHref}>
        <IconChat className="tile__icon" />
        Talk
      </a>
    </nav>
  );
}
