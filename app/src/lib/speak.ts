// Mochi's voice: the device's own text-to-speech. Browsers and the Windows app use speechSynthesis;
// the Android app, whose WebView has none, uses the text-to-speech plugin. Voices that run on the
// device come first; a browser's online voices (marked) send the reply's words to Microsoft or
// Google to be spoken. NEAR AI has no voice model, so speech is not attested.
import { TARGET } from './platform';

export type Voice = { id: string; name: string; lang: string; online: boolean };
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
/** A touch lighter than a person: Mochi is a small cloud. Much higher sounds robotic. */
const MOCHI_PITCH = 1.15;
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
export const speakable = (reply: string): string =>
  reply.replace(/\*[^*]*\*/g, ' ').replace(/\*/g, ' ').replace(/\s+/g, ' ').trim();

/** Where the next whole sentence of `raw` ends, looking from `from` and skipping *actions*; -1 if none yet. */
export function sentenceEnd(raw: string, from: number): number {
  let inAction = (raw.slice(0, from).split('*').length - 1) % 2 === 1;
  for (let i = from; i < raw.length; i++) {
    const c = raw[i];
    if (c === '*') inAction = !inAction;
    else if (!inAction && (c === '\n' || ('.!?…'.includes(c) && /\s/.test(raw[i + 1] ?? '')))) return i + 1;
  }
  return -1;
}

/** Device voices that sound most like a person, by the names their makers give them. */
const NATURAL = /natural|neural|enhanced|premium|siri|google/i;
/** Lower is better: on the device first, then natural-sounding, the device's own default, US English. */
const rank = (v: { name: string; lang: string; online: boolean; isDefault: boolean }) =>
  (v.online ? 8 : 0) + (NATURAL.test(v.name) ? 0 : 4) + (v.isDefault ? 0 : 2) + (/^en[-_]US/i.test(v.lang) ? 0 : 1);
const webRank = (v: SpeechSynthesisVoice) => rank({ name: v.name, lang: v.lang, online: !v.localService, isDefault: v.default });

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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** English voices on this device, for the voice picker. */
export async function listVoices(): Promise<Voice[]> {
  if (TARGET === 'android') {
    const tts = await plugin();
    // Android's speech engine starts in the background, and lists no voices until it's ready.
    for (let tries = 0; tries < 5; tries++) {
      const { voices } = await tts.getSupportedVoices().catch(() => ({ voices: [] as SpeechSynthesisVoice[] }));
      const found = voices
        .map((v, i) => ({ id: String(i), name: v.name, lang: v.lang, online: !v.localService }))
        .filter((v) => english(v.lang));
      if (found.length) return found;
      await wait(800);
    }
    return [];
  }
  return (await webVoices())
    .filter((v) => english(v.lang))
    .sort((a, b) => webRank(a) - webRank(b))
    .map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang, online: !v.localService }));
}

export const canSpeak = (): boolean => TARGET === 'android' || typeof speechSynthesis !== 'undefined';

/** Android only: open the phone's own screen for downloading a speech voice. */
export const canInstallVoice = (): boolean => TARGET === 'android';
export async function installVoice(): Promise<void> {
  await (await plugin()).openInstall();
}

const NO_VOICE = "This device couldn't speak. It may have no English voice installed yet.";

/** Chromium stops reporting the end of an utterance that gets garbage-collected, so keep it. */
let utterance: SpeechSynthesisUtterance | null = null;

/** Say one sentence; resolves when it has been spoken. */
async function sayOne(text: string, voiceId: string | null): Promise<void> {
  if (TARGET === 'android') {
    try {
      await (await plugin()).speak({ text, lang: 'en-US', pitch: MOCHI_PITCH, rate: MOCHI_RATE, ...(voiceId ? { voice: Number(voiceId) } : {}) });
    } catch {
      throw new Error(NO_VOICE);
    }
    return;
  }
  if (typeof speechSynthesis === 'undefined') return;
  const voices = await webVoices();
  // With no choice made, the most natural voice that runs on the device.
  const best = voices.filter((v) => english(v.lang) && v.localService).sort((a, b) => webRank(a) - webRank(b))[0];
  const voice = voices.find((v) => v.voiceURI === voiceId) ?? best ?? null;
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = MOCHI_PITCH;
    u.rate = MOCHI_RATE;
    if (voice) u.voice = voice;
    const done = () => {
      if (utterance === u) utterance = null;
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    utterance = u;
    speechSynthesis.speak(u);
    // Never hang voice chat on a voice that doesn't report the end.
    setTimeout(resolve, 2000 + text.length * 90);
  });
}

export type Speech = {
  /** The reply so far, while it streams in: every finished sentence starts speaking. */
  add(soFar: string): void;
  /** The whole reply; resolves when all of it has been spoken. Throws if the device can't speak. */
  finish(reply: string): Promise<void>;
  stop(): void;
};

/** Speaks a reply sentence by sentence, starting before the rest has arrived. */
export function createSpeech(voiceId: string | null, onStart?: () => void): Speech {
  let used = 0;
  let stopped = false;
  let started = false;
  let failure: unknown = null;
  let chain = Promise.resolve();
  // Cut off anything still speaking (Android's plugin does this itself on each new sentence).
  if (TARGET !== 'android' && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();

  function queue(chunk: string) {
    const text = speakable(chunk);
    if (!/\w/.test(text)) return;
    chain = chain.then(async () => {
      if (stopped || failure) return;
      if (!started) {
        started = true;
        onStart?.();
      }
      await sayOne(text, voiceId).catch((err) => {
        failure = err;
      });
    });
  }

  function add(soFar: string) {
    for (let end = sentenceEnd(soFar, used); end > 0; end = sentenceEnd(soFar, used)) {
      queue(soFar.slice(used, end));
      used = end;
    }
  }

  return {
    add,
    async finish(reply) {
      add(reply);
      queue(reply.slice(used));
      used = reply.length;
      await chain;
      if (failure) throw failure;
    },
    stop() {
      stopped = true;
      stopSpeaking();
    },
  };
}

/** Say a whole reply out loud; resolves when Mochi has finished speaking. Throws if the device can't speak. */
export const speak = (reply: string, voiceId: string | null): Promise<void> => createSpeech(voiceId).finish(reply);

export function stopSpeaking(): void {
  if (TARGET === 'android') plugin().then((tts) => tts.stop()).catch(() => undefined);
  else if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}
