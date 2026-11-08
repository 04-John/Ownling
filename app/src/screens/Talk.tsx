// 04 Talk: header with mini Mochi and runway, bubbles, a proof tag under every reply, a thinking
// Mochi and Pending tag while waiting, and the composer. Moments: thinking while waiting (talking
// on an egg: the hatching), talking while the reply types in and ~1.5 s after, verified for ~2 s.
import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import { useApp, usePet } from '../state';
import { capitalize, dayLabel, errorText, runwayPhrase, sameDay } from '../lib/format';
import { prefersReducedMotion } from '../lib/hooks';
import type { ChatTurn, Stage } from '../lib/types';
import type { Moment } from '../components/Mochi';
import { Mochi } from '../components/Mochi';
import { Bubble, withActions } from '../components/Bubble';
import { ProofTag, StatusTag, shownStatus } from '../components/ProofTag';
import { IconSend } from '../components/Icons';
import { BackButton, ErrorText } from '../components/ui';

const TYPE_MS = 22; // per tick
const TYPE_CHARS = 2; // characters per tick

export function Talk() {
  const { client, setPet } = useApp();
  const pet = usePet();
  const practice = client.config.practiceMode;
  const [turns, setTurns] = useState<ChatTurn[]>(() => client.history());
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState<{ stage: Stage } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState<{ turn: ChatTurn; shown: number } | null>(null);
  const [headMoment, setHeadMoment] = useState<Moment>('none');
  const timers = useRef<number[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setSending({ stage: pet.stage });
    setHeadMoment('none');
    setTurns((t) => [...t, mine]);
    try {
      const { reply, proof, pet: next } = await client.talk(text);
      const withProof: ChatTurn = { ...reply, proof: reply.proof ?? proof };
      setPet(next);
      setTurns((t) => [...t, withProof]);
      setTyping({ turn: withProof, shown: prefersReducedMotion() ? withProof.content.length : 0 });
      setHeadMoment('talking');
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
                    </>
                  )}
                </div>
              )}
            </Fragment>
          );
        })}
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
            placeholder={`Say something to ${pet.name}`}
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
