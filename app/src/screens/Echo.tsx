// Echo: talk, and Mochi says it straight back in a funny voice of its own. Hands-free like voice
// chat (it waits for a short pause), but nothing goes to NEAR AI or anywhere else: the clip is
// played back on this device and thrown away. Free: no food used.
import { useEffect, useRef, useState } from 'react';
import { usePet } from '../state';
import { startListening, canRecord, type Listener } from '../lib/voice';
import { ECHO_VOICES, echoBack, type EchoVoice } from '../lib/echo';
import { Mochi } from '../components/Mochi';
import type { Moment } from '../components/Mochi';
import { Button, ErrorText } from '../components/ui';
import { ArcadeBar, Asleep } from '../components/Arcade';

type Phase = 'ready' | 'listening' | 'echoing';

const VOICE_KEY = 'ownling.echo.v1';

function savedVoice(): EchoVoice {
  try {
    const v = localStorage.getItem(VOICE_KEY);
    return v && v in ECHO_VOICES ? (v as EchoVoice) : 'squeaky';
  } catch {
    return 'squeaky';
  }
}

export function Echo() {
  const pet = usePet();
  const [phase, setPhase] = useState<Phase>('ready');
  const [voice, setVoiceState] = useState<EchoVoice>(savedVoice);
  const [loud, setLoud] = useState(false);
  const [mouth, setMouth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listener = useRef<Listener | null>(null);
  const mounted = useRef(true);
  const current = useRef(voice);
  current.current = voice;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      listener.current?.stop();
    };
  }, []);

  function setVoice(v: EchoVoice) {
    setVoiceState(v);
    try {
      localStorage.setItem(VOICE_KEY, v);
    } catch {
      /* fine */
    }
  }

  async function start() {
    setError(null);
    try {
      listener.current = await startListening({
        silenceMs: () => 900,
        onLevel: (level) => setLoud(level > 0.02),
        onUtterance: (clip) => void say(clip),
      });
      setPhase('listening');
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      setError(denied ? 'Allow the microphone to play Echo.' : "The microphone didn't start.");
    }
  }

  async function say(clip: Blob) {
    if (!mounted.current) return;
    setPhase('echoing');
    setLoud(false);
    try {
      await echoBack(clip, current.current, (level) => mounted.current && setMouth(level > 0.03));
    } catch {
      if (mounted.current) setError("That didn't play back. Try saying it again.");
    }
    if (!mounted.current || !listener.current) return;
    setMouth(false);
    setPhase('listening');
    listener.current.resume();
  }

  function stop() {
    listener.current?.stop();
    listener.current = null;
    setPhase('ready');
    setLoud(false);
  }

  if (pet.hibernating) return <Asleep pet={pet} title="Echo" />;

  const moment: Moment = phase === 'echoing' ? (mouth ? 'talking' : 'none') : phase === 'listening' && loud ? 'thinking' : 'none';
  const status =
    phase === 'ready' ? `Say anything, and ${pet.name} says it back.`
      : phase === 'listening' ? (loud ? 'Listening…' : `Go on, say something to ${pet.name}`)
        : `${pet.name} says it back…`;

  return (
    <main className="screen screen--voice">
      <ArcadeBar title="Echo" />
      <h1 className="sr-only" tabIndex={-1}>
        Echo
      </h1>

      <div className={phase === 'listening' && loud ? 'voice-stage voice-stage--loud' : 'voice-stage'}>
        <Mochi stage={pet.stage} mood={pet.mood} moment={moment} size={240} name={pet.name} outfit={pet.outfit} />
      </div>
      <p className="voice-status" role="status">
        {status}
      </p>

      <ErrorText>{error}</ErrorText>
      {!canRecord() ? (
        <p className="note center">This browser can't use the microphone.</p>
      ) : phase === 'ready' ? (
        <Button onClick={start}>Start</Button>
      ) : (
        <Button variant="secondary" onClick={stop}>
          Stop
        </Button>
      )}

      <section className="card voice-settings" aria-label="Echo voice">
        <div className="field">
          <span className="field__label">{pet.name}'s echo voice</span>
          <div className="three-up">
            {(Object.keys(ECHO_VOICES) as EchoVoice[]).map((v) => (
              <button
                key={v}
                type="button"
                className={voice === v ? 'btn btn--primary voice-choice' : 'btn btn--secondary voice-choice'}
                aria-pressed={voice === v}
                onClick={() => setVoice(v)}
              >
                {ECHO_VOICES[v].label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <p className="footnote">
        Echo never sends your voice anywhere. It's played back on this device and then thrown away, and it uses no food.
      </p>
    </main>
  );
}
