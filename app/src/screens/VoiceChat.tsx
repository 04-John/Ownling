// Voice chat: talk with Mochi hands-free, like a call. Your words appear as you speak (NEAR AI's
// Whisper, every few seconds); after a pause of 3 or 5 seconds they're sent; Mochi answers out
// loud in the device's own voice, then listens again. Replies are checked like typed ones, and
// each exchange lands in the Talk history and the diary.
import { useEffect, useRef, useState } from 'react';
import { useApp, usePet } from '../state';
import { navigate } from '../lib/router';
import { errorText } from '../lib/format';
import { startListening, toWav, type Listener } from '../lib/voice';
import {
  canInstallVoice, canSpeak, installVoice, listVoices, loadVoiceSettings, saveVoiceSettings, speak, stopSpeaking, type Voice, type VoiceSettings,
} from '../lib/speak';
import type { ChatTurn } from '../lib/types';
import type { Moment } from '../components/Mochi';
import { Mochi } from '../components/Mochi';
import { Bubble } from '../components/Bubble';
import { ProofTag } from '../components/ProofTag';
import { BackButton, Button, ErrorText } from '../components/ui';

type Phase = 'ready' | 'listening' | 'hearing' | 'thinking' | 'speaking';

const MOMENT: Record<Phase, Moment> = { ready: 'none', listening: 'none', hearing: 'thinking', thinking: 'thinking', speaking: 'talking' };

function micError(err: unknown): string {
  const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
  return denied ? 'Allow the microphone to use voice chat.' : "The microphone didn't start.";
}

export function VoiceChat() {
  const { client, setPet } = useApp();
  const pet = usePet();
  const [settings, setSettingsState] = useState<VoiceSettings>(loadVoiceSettings);
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [said, setSaid] = useState('');
  const [reply, setReply] = useState<ChatTurn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loud, setLoud] = useState(false);
  const listener = useRef<Listener | null>(null);
  const partialBusy = useRef(false);
  const mounted = useRef(true);
  const current = useRef(settings);
  current.current = settings;

  useEffect(() => {
    mounted.current = true;
    listVoices().then(setVoices).catch(() => setVoices([]));
    return () => {
      mounted.current = false;
      listener.current?.stop();
      stopSpeaking();
    };
  }, []);

  function setSettings(next: Partial<VoiceSettings>) {
    const s = { ...current.current, ...next };
    setSettingsState(s);
    saveVoiceSettings(s);
  }

  async function start() {
    setError(null);
    try {
      listener.current = await startListening({
        silenceMs: () => current.current.silenceMs,
        onLevel: (level) => setLoud(level > 0.02),
        onPartial: async (clip) => {
          if (partialBusy.current) return;
          partialBusy.current = true;
          try {
            const text = await client.listen(await toWav(clip));
            if (mounted.current && text) setSaid(text);
          } catch {
            /* the full clip is heard at the pause anyway */
          } finally {
            partialBusy.current = false;
          }
        },
        onUtterance: (clip) => void answer(clip),
      });
      setSaid('');
      setPhase('listening');
    } catch (err) {
      setError(micError(err));
    }
  }

  /** One turn: hear what you said, send it, say Mochi's reply, then listen again. */
  async function answer(clip: Blob) {
    setPhase('hearing');
    setError(null);
    try {
      const text = await client.listen(await toWav(clip));
      if (!mounted.current) return;
      if (text) {
        setSaid(text);
        setPhase('thinking');
        const r = await client.talk(text);
        if (!mounted.current) return;
        setPet(r.pet);
        setReply({ ...r.reply, proof: r.reply.proof ?? r.proof });
        if (current.current.spoken && canSpeak()) {
          setPhase('speaking');
          await speak(r.reply.content, current.current.voiceId);
        }
      }
    } catch (err) {
      if (mounted.current) setError(errorText(err));
    }
    if (!mounted.current || !listener.current) return;
    setSaid('');
    setPhase('listening');
    listener.current.resume();
  }

  function end() {
    listener.current?.stop();
    listener.current = null;
    stopSpeaking();
    navigate('/talk', { replace: true });
  }

  const status =
    phase === 'ready' ? `Tap Start, then just talk. ${pet.name} answers when you pause.`
      : phase === 'listening' ? (loud ? 'Listening…' : `Listening… say something to ${pet.name}`)
        : phase === 'hearing' ? 'Got it…'
          : phase === 'thinking' ? `${pet.name} is thinking…`
            : `${pet.name} is talking…`;

  return (
    <main className="screen screen--voice">
      <div className="topbar">
        <BackButton to="/talk" />
        <span className="eyebrow">VOICE CHAT</span>
        <span className="topbar__spacer" />
      </div>

      <div className={phase === 'listening' && loud ? 'voice-stage voice-stage--loud' : 'voice-stage'}>
        <Mochi stage={pet.stage} mood={pet.mood} moment={MOMENT[phase]} size={220} name={pet.name} outfit={pet.outfit} />
      </div>
      <p className="voice-status" role="status">
        {status}
      </p>

      <div className="voice-log" aria-live="polite">
        {said ? <Bubble from="you" text={said} speaker="You" /> : null}
        {reply && phase !== 'hearing' ? (
          <div className="talk-reply">
            <Bubble from="mochi" text={reply.content} speaker={pet.name} />
            {reply.proof ? <ProofTag proof={reply.proof} practiceMode={client.config.practiceMode} /> : null}
          </div>
        ) : null}
      </div>

      <ErrorText>{error}</ErrorText>
      {pet.hibernating ? (
        <p className="note center">{pet.name} is hibernating. Feed it first, then you can talk.</p>
      ) : phase === 'ready' ? (
        <Button onClick={start}>Start talking</Button>
      ) : (
        <Button variant="secondary" onClick={end}>
          End voice chat
        </Button>
      )}

      <section className="card voice-settings" aria-label="Voice settings">
        <label className="field">
          <span className="field__label">{pet.name}'s voice</span>
          <select className="input" value={settings.voiceId ?? ''} onChange={(e) => setSettings({ voiceId: e.target.value || null })}>
            <option value="">This device's default</option>
            {(voices ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span className="field__label">Send after a pause of</span>
          <div className="two-up">
            {([3000, 5000] as const).map((ms) => (
              <button
                key={ms}
                type="button"
                className={settings.silenceMs === ms ? 'btn btn--primary voice-choice' : 'btn btn--secondary voice-choice'}
                aria-pressed={settings.silenceMs === ms}
                onClick={() => setSettings({ silenceMs: ms })}
              >
                {ms / 1000} seconds
              </button>
            ))}
          </div>
        </div>
        <div className="two-up">
          <button type="button" className="btn btn--secondary voice-choice" aria-pressed={settings.spoken} onClick={() => setSettings({ spoken: !settings.spoken })}>
            {settings.spoken ? `${pet.name} talks back: on` : `${pet.name} talks back: off`}
          </button>
          <button
            type="button"
            className="btn btn--secondary voice-choice"
            onClick={() => speak(`Hi, it's ${pet.name}. Is this a good voice?`, settings.voiceId).catch((err) => setError(errorText(err)))}
            disabled={!canSpeak()}
          >
            Try the voice
          </button>
        </div>
        {voices && voices.length === 0 ? (
          <div className="stack-6">
            <p className="note">
              No voice found on this device, so {pet.name} can only write its replies.
              {canInstallVoice()
                ? ' Install one: tap below, or install "Speech Services by Google" from the Play Store and choose it under Settings, General management, Text-to-speech.'
                : ''}
            </p>
            {canInstallVoice() ? (
              <Button variant="secondary" className="voice-choice" onClick={() => installVoice().catch((err) => setError(errorText(err)))}>
                Install a voice
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <p className="footnote">
        Your voice goes to NEAR AI to become text and isn't kept. {pet.name}'s voice is your device's own, so its replies
        aren't sent anywhere to be spoken.
      </p>
    </main>
  );
}
