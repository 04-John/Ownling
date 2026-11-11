// Mochi's voice: the device's own text-to-speech, so replies are spoken without sending them
// anywhere. Browsers and the Windows app use speechSynthesis; the Android app, whose WebView has
// none, uses the text-to-speech plugin. NEAR AI has no voice model, so this is not attested.
import { TARGET } from './platform';

export type Voice = { id: string; name: string; lang: string };
export type VoiceSettings = {
  /** Chosen voice id, or null for the device's default English voice. */
  voiceId: string | null;
  /** How long a pause ends what you're saying in voice chat. */
  silenceMs: 3000 | 5000;
  /** Whether Mochi answers out loud. */
  spoken: boolean;
};

const SETTINGS_KEY = 'ownling.voice.v1';
const DEFAULTS: VoiceSettings = { voiceId: null, silenceMs: 3000, spoken: true };
/** A little higher and lighter than a person: Mochi is a small cloud. */
const MOCHI_PITCH = 1.45;
const MOCHI_RATE = 1.0;

export function loadVoiceSettings(): VoiceSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export function saveVoiceSettings(s: VoiceSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* private window: settings last for this visit */
  }
}

/** What Mochi says aloud: the reply without its *actions*. */
export const speakable = (reply: string): string => reply.replace(/\*[^*]*\*/g, ' ').replace(/\s+/g, ' ').trim();

const plugin = () => import('@capacitor-community/text-to-speech').then((m) => m.TextToSpeech);
const english = (lang: string) => /^en/i.test(lang);

function webVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  // Chromium loads the list after the first call.
  return new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

/** English voices on this device, for the voice picker. */
export async function listVoices(): Promise<Voice[]> {
  if (TARGET === 'android') {
    const { voices } = await (await plugin()).getSupportedVoices();
    return voices.map((v, i) => ({ id: String(i), name: v.name, lang: v.lang })).filter((v) => english(v.lang));
  }
  return (await webVoices()).filter((v) => english(v.lang)).map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang }));
}

export const canSpeak = (): boolean => TARGET === 'android' || typeof speechSynthesis !== 'undefined';

/** Say a reply out loud; resolves when Mochi has finished speaking (or right away if it can't). */
export async function speak(reply: string, voiceId: string | null): Promise<void> {
  const text = speakable(reply);
  if (!text) return;
  if (TARGET === 'android') {
    await (await plugin()).speak({ text, lang: 'en-US', pitch: MOCHI_PITCH, rate: MOCHI_RATE, ...(voiceId ? { voice: Number(voiceId) } : {}) });
    return;
  }
  if (typeof speechSynthesis === 'undefined') return;
  const voices = await webVoices();
  const voice = voices.find((v) => v.voiceURI === voiceId) ?? voices.find((v) => english(v.lang) && v.localService) ?? null;
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = MOCHI_PITCH;
    u.rate = MOCHI_RATE;
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    // Never hang voice chat on a voice that doesn't report the end.
    setTimeout(resolve, 2000 + text.length * 90);
  });
}

export function stopSpeaking(): void {
  if (TARGET === 'android') plugin().then((tts) => tts.stop()).catch(() => undefined);
  else if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}
