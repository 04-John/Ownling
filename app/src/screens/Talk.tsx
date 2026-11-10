// 04 Talk: header with mini Mochi and runway, bubbles, a proof tag under every reply (and what
// Mochi will remember, when it learned something), a thinking Mochi and Pending tag while waiting,
// and the composer. Opened with ?game=<id> it plays a round: Mochi asks first, a game bar shows
// above the chat, and a result card offers Play again. Moments: thinking while waiting (talking on
// an egg: the hatching), talking while the reply types in and ~1.5 s after, verified for ~2 s.
import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import { GAMES } from '../../../shared/mind';
import { useApp, usePet } from '../state';
import { capitalize, dayLabel, errorText, fmtCountdown, runwayPhrase, sameDay, stageRank } from '../lib/format';
import { prefersReducedMotion } from '../lib/hooks';
import { navigate, useRoute } from '../lib/router';
import type { ActiveGame, ChatTurn, GameId, PetState, Stage, TalkResult } from '../lib/types';
import type { Moment } from '../components/Mochi';
import { Mochi } from '../components/Mochi';
import { Bubble, withActions } from '../components/Bubble';
import { ProofTag, StatusTag, shownStatus } from '../components/ProofTag';
import { IconSend } from '../components/Icons';
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

  /** Show a reply as it types in, note growth, and close the round if this reply ended it. */
  async function showReply(r: TalkResult, stageBefore: Stage) {
    setPet(r.pet);
    setTurns((t) => [...t, r.reply]);
    setTyping({ turn: r.reply, shown: prefersReducedMotion() ? r.reply.content.length : 0 });
    setHeadMoment('talking');
    if (stageRank(r.pet.stage) > stageRank(stageBefore)) setGrewTo(r.pet.stage);
    if (r.result) setRoundEnd({ result: r.result, bond: r.result === 'win' ? await addBond(r.pet) : null });
  }

  /** A won round adds a bond point on chain, at most one every 10 minutes. */
  async function addBond(now: PetState): Promise<string | null> {
    if (now.playReadyAt && now.playReadyAt > Date.now()) {
      return `Your bond grows again in ${fmtCountdown(now.playReadyAt - Date.now())}.`;
    }
    try {
      setPet(await client.play());
      return 'Bond +1.';
    } catch {
      return null;
    }
  }

  async function startRound(id: GameId) {
    setError(null);
    setRoundEnd(null);
    setGrewTo(null);
    setSending({ stage: pet.stage });
    try {
      const r = await client.startGame(id);
      setGame(r.game);
      await showReply(r, pet.stage);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSending(null);
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

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending || pet.hibernating) return;
    const mine: ChatTurn = { role: 'user', content: text, at: Date.now() };
    setDraft('');
    setError(null);
    setGrewTo(null);
    setSending({ stage: pet.stage });
    setHeadMoment('none');
    setTurns((t) => [...t, mine]);
    try {
      const r = await client.talk(text, playing);
      await showReply({ ...r, reply: { ...r.reply, proof: r.reply.proof ?? r.proof } }, pet.stage);
    } catch (err) {
      setTurns((t) => t.filter((x) => x !== mine));
      setDraft(text);
      setError(errorText(err));
    } finally {
      setSending(null);
      inputRef.current?.focus();
    }
  }

  const subtitle = pet.hibernating ? 'Hibernating' : capitalize(runwayPhrase(pet.runwayDays));

  return (
    <main className="screen screen--talk">
      <header className="talk-head">
        <BackButton to="/home" variant="plain" />
        <div className="talk-head__avatar">
          <Mochi stage={pet.stage} mood={pet.mood} moment={headMoment} size={46} name={pet.name} />
        </div>
        <div className="talk-head__text">
          <h1 className="talk-head__name" tabIndex={-1}>
            {pet.name}
          </h1>
          <div className="talk-head__sub">{subtitle}</div>
        </div>
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
                      <ProofTag proof={t.proof} practiceMode={practice} />
                      {t.learned?.map((fact) => (
                        <p key={fact} className="learned">
                          {pet.name} will remember: {fact}
                        </p>
                      ))}
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
        {sending ? (
          <div className="talk-pending">
            <Mochi
              stage={sending.stage}
              mood={pet.mood}
              moment={sending.stage === 'egg' ? 'talking' : 'thinking'}
              size={64}
              name={pet.name}
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
            placeholder={playing ? PLACEHOLDER[playing.id] : `Say something to ${pet.name}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
            enterKeyHint="send"
            maxLength={1000}
            disabled={pet.hibernating}
          />
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
