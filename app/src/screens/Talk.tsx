// 04 Talk: header with mini Mochi and runway, bubbles, a proof tag under every reply (and what
// Mochi will remember, when it learned something), a thinking Mochi and Pending tag while waiting,
// and the composer. Opened with ?game=<id> it plays a round: Mochi asks first, a game bar shows
// above the chat, and a result card offers Play again. Moments: thinking while waiting (talking on
// an egg: the hatching), talking while the reply types in and ~1.5 s after, verified for ~2 s.
import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import { GAMES } from '../../../shared/mind';
import { newlyUnlocked, type Item } from '../../../shared/wardrobe';
import { useApp, usePet } from '../state';
import { capitalize, dayLabel, errorText, fmtCountdown, runwayPhrase, sameDay, stageRank } from '../lib/format';
import { prefersReducedMotion } from '../lib/hooks';
import { navigate, useRoute } from '../lib/router';
import { actionTarget } from '../lib/actions';
import type { ActiveGame, ChatTurn, GameId, PetState, Stage, TalkResult } from '../lib/types';
import type { Moment } from '../components/Mochi';
import { Mochi } from '../components/Mochi';
import { Bubble, withActions } from '../components/Bubble';
import { ProofTag, StatusTag, shownStatus } from '../components/ProofTag';
import { IconMic, IconSend, IconStop, IconWaves } from '../components/Icons';
import { canRecord, toWav, useRecorder } from '../lib/voice';
import { BackButton, Button, ErrorText } from '../components/ui';

const TYPE_MS = 22; // per tick
const TYPE_CHARS = 2; // characters per tick

const PLACEHOLDER: Record<GameId, string> = { riddle: 'Your answer', guess: 'Ask a yes-or-no question', rather: 'Pick one' };

export function Talk() {
  const { client, setPet } = useApp();
  const pet = usePet();
  const route = useRoute();
  const practice = client.config.practiceMode;
  const [turns, setTurns] = useState<ChatTurn[]>(() => client.history());
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState<{ stage: Stage } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState<{ turn: ChatTurn; shown: number } | null>(null);
  const [headMoment, setHeadMoment] = useState<Moment>('none');
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [roundEnd, setRoundEnd] = useState<{ result: 'win' | 'lose'; bond: string | null } | null>(null);
  const [grewTo, setGrewTo] = useState<Stage | null>(null);
  const [unlocked, setUnlocked] = useState<Item[]>([]);
  const [hearing, setHearing] = useState(false);
  /** Mochi's reply while it's being written, before its proof is checked. */
  const [streaming, setStreaming] = useState<string | null>(null);
  const streamedRef = useRef(false);
  const onText = (text: string) => {
    streamedRef.current = true;
    setStreaming(text);
    setHeadMoment('talking');
  };
  const timers = useRef<number[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startedFor = useRef<string | null>(null);
  const asked = route.query.get('game');
  const askedGame = asked && asked in GAMES ? (asked as GameId) : null;
  const playing = roundEnd ? null : game;

  // Opening Talk from the Play sheet (?game=riddle) starts a round: Mochi asks first.
  useEffect(() => {
    if (!askedGame) {
      startedFor.current = null;
      return;
    }
    if (startedFor.current === askedGame || pet.hibernating) return;
    startedFor.current = askedGame;
    void startRound(askedGame);
  }, [askedGame, pet.hibernating]);

  /** Show a reply as it types in, note growth and new outfits, and close the round if this reply
   * ended it. `before` is the pet as it was when the message was sent. */
  async function showReply(r: TalkResult, before: PetState) {
    setPet(r.pet);
    // The client's history, so a greeting that arrived while you were typing shows up too.
    setTurns(client.history());
    // A streamed reply is already on screen, so it doesn't type in again.
    setTyping({ turn: r.reply, shown: prefersReducedMotion() || streamedRef.current ? r.reply.content.length : 0 });
    setHeadMoment('talking');
    if (stageRank(r.pet.stage) > stageRank(before.stage)) setGrewTo(r.pet.stage);
    let after = r.pet;
    if (r.result) {
      const won = r.result === 'win' ? await addBond(r.pet) : null;
      if (won) after = won.pet ?? after;
      setRoundEnd({ result: r.result, bond: won?.note ?? null });
    }
    const fresh = newlyUnlocked(before, after);
    if (fresh.length) setUnlocked(fresh);
  }

  /** A won round adds a bond point on chain, at most one every 10 minutes. */
  async function addBond(now: PetState): Promise<{ note: string; pet?: PetState } | null> {
    if (now.playReadyAt && now.playReadyAt > Date.now()) {
      return { note: `Your bond grows again in ${fmtCountdown(now.playReadyAt - Date.now())}.` };
    }
    try {
      const next = await client.play();
      setPet(next);
      return { note: 'Bond +1.', pet: next };
    } catch {
      return null;
    }
  }

  async function startRound(id: GameId) {
    setError(null);
    setRoundEnd(null);
    setGrewTo(null);
    setUnlocked([]);
    setSending({ stage: pet.stage });
    try {
      streamedRef.current = false;
      const r = await client.startGame(id, onText);
      setGame(r.game);
      await showReply(r, pet);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSending(null);
      setStreaming(null);
    }
  }

  function endGame() {
    setGame(null);
    setRoundEnd(null);
    navigate('/talk', { replace: true });
  }

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Type the newest reply in, then hold "talking" ~1.5 s, then "verified" ~2 s if the proof passed.
  useEffect(() => {
    if (!typing) return;
    const { turn } = typing;
    if (typing.shown < turn.content.length) {
      const id = window.setTimeout(() => setTyping({ turn, shown: typing.shown + TYPE_CHARS }), TYPE_MS);
      return () => window.clearTimeout(id);
    }
    setTyping(null);
    const verified = shownStatus(turn.proof, practice) === 'verified';
    timers.current.push(
      window.setTimeout(() => {
        if (verified) {
          setHeadMoment('verified');
          timers.current.push(window.setTimeout(() => setHeadMoment('none'), 2000));
        } else setHeadMoment('none');
      }, 1500),
    );
  }, [typing, practice]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [turns.length, sending, typing?.shown, error]);

  function send(e: FormEvent) {
    e.preventDefault();
    void say(draft.trim());
  }

  /** The microphone: tap to start, tap again (or 30 s) to stop; the words go out as a message. */
  const voice = useRecorder(async (clip) => {
    setHearing(true);
    setError(null);
    try {
      const text = await client.listen(await toWav(clip));
      if (text) await say(text);
      else setError(`${pet.name} didn't catch that. Try again, a little closer.`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setHearing(false);
    }
  });

  async function toggleMic() {
    if (voice.recording) return voice.stop();
    setError(null);
    try {
      await voice.start();
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      setError(denied ? 'Allow the microphone to talk out loud.' : "The microphone didn't start.");
    }
  }

  async function say(text: string) {
    if (!text || sending || pet.hibernating) return;
    const mine: ChatTurn = { role: 'user', content: text, at: Date.now() };
    setDraft('');
    setError(null);
    setGrewTo(null);
    setUnlocked([]);
    setSending({ stage: pet.stage });
    setHeadMoment('none');
    setTurns((t) => [...t, mine]);
    try {
      streamedRef.current = false;
      const r = await client.talk(text, playing, onText);
      await showReply({ ...r, reply: { ...r.reply, proof: r.reply.proof ?? r.proof } }, pet);
    } catch (err) {
      setTurns((t) => t.filter((x) => x !== mine));
      setDraft(text);
      setError(errorText(err));
    } finally {
      setSending(null);
      setStreaming(null);
      inputRef.current?.focus();
    }
  }

  const subtitle = pet.hibernating ? 'Hibernating' : capitalize(runwayPhrase(pet.runwayDays));

  return (
    <main className="screen screen--talk">
      <header className="talk-head">
        <BackButton to="/home" variant="plain" />
        <div className="talk-head__avatar">
          <Mochi stage={pet.stage} mood={pet.mood} moment={headMoment} size={46} name={pet.name} outfit={pet.outfit} />
        </div>
        <div className="talk-head__text">
          <h1 className="talk-head__name" tabIndex={-1}>
            {pet.name}
          </h1>
          <div className="talk-head__sub">{subtitle}</div>
        </div>
        {pet.hibernating ? null : (
          <a className="icon-button icon-button--circle talk-head__voice" href="#/voice" aria-label="Voice chat">
            <IconWaves />
          </a>
        )}
      </header>

      {game ? (
        <div className="game-bar">
          <span className="game-bar__title">{GAMES[game.id].title}</span>
          <button type="button" className="text-button" onClick={endGame}>
            End game
          </button>
        </div>
      ) : null}

      <div className="talk-log" role="log" aria-label={`Conversation with ${pet.name}`}>
        {turns.length === 0 && !sending ? (
          <p className="talk-empty">
            {pet.stage === 'egg' ? `Say hello. ${pet.name} hatches when you say its first word.` : `Say something to ${pet.name}.`}
          </p>
        ) : null}
        {turns.map((t, i) => {
          const showDay = i === 0 || !sameDay(turns[i - 1].at, t.at);
          const isTyping = typing?.turn === t;
          return (
            <Fragment key={`${t.at}-${i}`}>
              {showDay ? <div className="talk-day">{dayLabel(t.at)}</div> : null}
              {t.role === 'user' ? (
                <Bubble from="you" text={t.content} speaker="You" />
              ) : (
                <div className="talk-reply">
                  {isTyping ? (
                    <>
                      <div className="bubble bubble--mochi bubble--paper" aria-hidden="true">
                        {withActions(t.content.slice(0, typing?.shown ?? 0))}
                      </div>
                      <span className="sr-only">
                        {pet.name}: {t.content}
                      </span>
                    </>
                  ) : (
                    <>
                      <Bubble from="mochi" text={t.content} speaker={pet.name} />
                      {/* Replies loaded from the diary carry no proof, so they show no tag. */}
                      {t.proof ? <ProofTag proof={t.proof} practiceMode={practice} /> : null}
                      {t.learned?.map((fact) => (
                        <p key={fact} className="learned">
                          {pet.name} will remember: {fact}
                        </p>
                      ))}
                      {/* What you asked Mochi for: a button on its latest reply that opens it. */}
                      {t.action && i === turns.length - 1 && !sending && !game ? (
                        <Button variant="secondary" className="talk-action" onClick={() => navigate(actionTarget(t.action!, pet.name).route, { replace: true })}>
                          {actionTarget(t.action, pet.name).label}
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              )}
            </Fragment>
          );
        })}
        {grewTo && !typing ? (
          <p className="talk-notice" role="status">
            {grewTo === 'baby' ? `${pet.name} hatched.` : `${pet.name} grew into a ${grewTo}. It looks and talks a little different now.`}
          </p>
        ) : null}
        {unlocked.length && !typing ? (
          <p className="talk-notice" role="status">
            New outfit unlocked: {unlocked.map((i) => i.name).join(', ')}.{' '}
            <a href="#/wardrobe">Open the wardrobe</a>
          </p>
        ) : null}
        {roundEnd && game && !typing ? (
          <div className="round-end" role="status">
            <p className="round-end__title">
              {roundEnd.result === 'win' ? 'You won this round.' : `${pet.name} wins this one.`}
            </p>
            {roundEnd.bond ? <p className="note">{roundEnd.bond}</p> : null}
            <div className="two-up">
              <Button variant="secondary" onClick={() => void startRound(game.id)}>
                Play again
              </Button>
              <Button variant="secondary" onClick={endGame}>
                Done
              </Button>
            </div>
          </div>
        ) : null}
        {sending && streaming ? (
          <div className="talk-reply">
            <Bubble from="mochi" text={streaming} speaker={pet.name} />
            <StatusTag status="pending" />
          </div>
        ) : sending ? (
          <div className="talk-pending">
            <Mochi
              stage={sending.stage}
              mood={pet.mood}
              moment={sending.stage === 'egg' ? 'talking' : 'thinking'}
              size={64}
              name={pet.name}
              outfit={pet.outfit}
            />
            <StatusTag status="pending" />
            <span className="sr-only" role="status">
              {pet.name} is thinking
            </span>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={send}>
        {pet.hibernating ? (
          <p className="composer__notice">
            {pet.name} is hibernating and can't think right now. <a href="#/home">Wake it up</a>
          </p>
        ) : null}
        <ErrorText>{error}</ErrorText>
        <div className="composer__row">
          <label htmlFor="say" className="sr-only">
            Message
          </label>
          <input
            id="say"
            ref={inputRef}
            className="composer__input"
            placeholder={
              voice.recording ? 'Listening… tap ■ to send'
                : hearing ? `${pet.name} is listening…`
                  : playing ? PLACEHOLDER[playing.id] : `Say something to ${pet.name}`
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
            enterKeyHint="send"
            maxLength={1000}
            disabled={pet.hibernating || voice.recording || hearing}
          />
          {canRecord() && !pet.hibernating ? (
            <button
              type="button"
              className={voice.recording ? 'composer__mic composer__mic--on' : 'composer__mic'}
              aria-label={voice.recording ? 'Stop and send' : 'Talk out loud'}
              aria-pressed={voice.recording}
              onClick={toggleMic}
              disabled={!!sending || hearing}
            >
              {voice.recording ? <IconStop /> : <IconMic />}
            </button>
          ) : null}
          <button
            type="submit"
            className="composer__send"
            aria-label="Send"
            disabled={!!sending || pet.hibernating}
          >
            <IconSend />
          </button>
        </div>
      </form>
    </main>
  );
}
