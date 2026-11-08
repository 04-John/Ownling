// Feed / Play / Talk. Only Talk is filled. During the play cooldown, Play reads "Rest 9:58".
import { IconChat, IconDrop, IconSparkle } from './Icons';
import { fmtCountdown } from '../lib/format';

type Props = {
  feedHref: string;
  talkHref: string;
  onPlay: () => void;
  playBusy: boolean;
  /** Milliseconds of cooldown left, or null when Play is available. */
  restLeftMs: number | null;
};

export function ActionTiles({ feedHref, talkHref, onPlay, playBusy, restLeftMs }: Props) {
  const resting = restLeftMs != null && restLeftMs > 0;
  return (
    <nav className="tiles" aria-label="Actions">
      <a className="tile" href={feedHref}>
        <IconDrop className="tile__icon" />
        Feed
      </a>
      <button
        type="button"
        className={resting ? 'tile tile--resting' : 'tile'}
        onClick={() => !resting && !playBusy && onPlay()}
        aria-disabled={resting || playBusy}
        aria-busy={playBusy}
      >
        <IconSparkle className="tile__icon" />
        {resting ? (
          <>
            <span aria-hidden="true">Rest {fmtCountdown(restLeftMs)}</span>
            <span className="sr-only">Play. Resting for {Math.ceil(restLeftMs / 60000)} more minutes</span>
          </>
        ) : (
          'Play'
        )}
      </button>
      <a className="tile tile--primary" href={talkHref}>
        <IconChat className="tile__icon" />
        Talk
      </a>
    </nav>
  );
}
