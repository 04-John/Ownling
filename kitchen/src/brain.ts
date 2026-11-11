// A pet's thoughts: an end-to-end-encrypted chat on a NEAR AI TEE model, with the reply's
// signature verified against the attested model before anyone sees it.
import { createHash } from 'node:crypto';
import { InferenceClient } from '@nearai/inference-sdk/node';
import { MAX_HISTORY, MAX_REPLY_TOKENS, openingLine, parseThought, settleRound, systemPrompt, type Mode } from '../../shared/mind.ts';
import { practiceReply } from '../../shared/practice.ts';
import { fixName } from '../../shared/speech.ts';
import type { PetView } from './chain.ts';
import { config } from './config.ts';
import { modelFor } from './pricing.ts';

export type Turn = { role: 'user' | 'assistant'; content: string };

export type Proof = {
  id: string;
  kind: 'provider_tee' | 'gateway';
  signer: { signingAlgo: string; signingAddress: string };
  signedText: string;
  signature: string;
  /** sha256 of signedText + signature; recorded on-chain in the charge receipt. */
  hash: string;
};

export type Thought = {
  reply: string;
  /** New facts about the owner, for the diary. */
  remember: string[];
  /** Set when this reply ended a game round. */
  result: 'win' | 'lose' | null;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number };
  /** Null in practice mode: nothing was verified. */
  proof: Proof | null;
  receipt: string;
};

/** Practice mode (KITCHEN_MOCK=1): fixed replies (shared/practice.ts), no AI call, never presented as verified. */
export const PRACTICE_MODE = process.env.KITCHEN_MOCK === '1';

const client = new InferenceClient({
  baseUrl: config.nearAiBaseUrl,
  apiKey: config.nearAiApiKey,
  e2ee: true,
});

/** NEAR AI's speech-to-text model (attested, verifiable in its model list). */
export const LISTEN_MODEL = 'openai/whisper-large-v3';
const AUDIO_EXT: Record<string, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav' };

/**
 * Speech to text on NEAR AI's Whisper. `hint` (the pet's name) helps it spell the name right. The
 * clip goes to NEAR AI over TLS (NEAR AI offers no end-to-end encryption for audio) and is not
 * kept anywhere; only the text comes back.
 */
export async function transcribe(audio: Buffer, type: string, hint?: string): Promise<string> {
  if (PRACTICE_MODE) return `Hello ${hint ?? 'Mochi'}, how are you today?`;
  markUsed();
  const base = type.split(';')[0].trim();
  const form = new FormData();
  form.append('model', LISTEN_MODEL);
  if (hint) form.append('prompt', hint);
  form.append('file', new Blob([new Uint8Array(audio)], { type: base }), `voice.${AUDIO_EXT[base] ?? 'webm'}`);
  const res = await fetch(`${config.nearAiBaseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.nearAiApiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`NEAR AI couldn't hear that clip (${res.status}: ${(await res.text()).slice(0, 160)})`);
  const json = (await res.json()) as { text?: string };
  return fixName((json.text ?? '').trim(), hint);
}

/**
 * The first request on a new connection takes NEAR AI 20 s to 2 min (key exchange and attestation);
 * later ones take a few seconds. One tiny request at startup pays that cost before any player does.
 */
export async function warmUp(): Promise<number> {
  const started = Date.now();
  await client.chat.completions.create({
    model: config.defaultModel,
    max_tokens: 1,
    reasoning_effort: 'low',
    messages: [{ role: 'user', content: 'Hi' }],
  });
  return Date.now() - started;
}

/** Half a second of silence as 16 kHz mono WAV, to keep the speech model warm. */
function silentWav(): Buffer {
  const samples = 8_000;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16_000, 24);
  wav.writeUInt32LE(32_000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  return wav;
}

let lastUsed = 0;
const markUsed = () => {
  lastUsed = Date.now();
};

/**
 * A connection left idle goes cold again, and the next player waits 20 s or more. Every few
 * minutes without traffic, one tiny chat and half a second of silence keep both models warm (a few
 * hundredths of a cent a day).
 */
export function keepWarm(everyMs = 4 * 60_000): void {
  setInterval(() => {
    if (Date.now() - lastUsed < everyMs) return;
    markUsed();
    warmUp().catch((err) => console.error(`warm-up failed: ${(err as Error).message}`));
    transcribe(silentWav(), 'audio/wav').catch(() => undefined);
  }, everyMs);
}

/**
 * One thought. `message` is null when Mochi speaks first: a greeting, or the start of a game round.
 * The reply's REMEMBER and RESULT lines are split off (parseThought) after the signature check,
 * which covers the full text the model signed.
 */
export async function think(
  pet: PetView,
  history: Turn[],
  message: string | null,
  memory?: string,
  mode: Mode = { kind: 'talk' },
): Promise<Thought> {
  if (PRACTICE_MODE) {
    return {
      ...parseThought(practiceReply(pet, history, message, mode)),
      model: 'practice',
      usage: { prompt_tokens: 0, completion_tokens: 0 },
      proof: null,
      receipt: `practice|${pet.token_id}|${Date.now()}`,
    };
  }
  markUsed();
  const model = await modelFor(pet.model);
  const completion = await client.chat.completions.create({
    model,
    max_tokens: MAX_REPLY_TOKENS,
    // GLM-5.3 Flash reasons by default; "low" keeps it to a few tokens, which a pet's chat doesn't need.
    reasoning_effort: 'low',
    messages: [
      { role: 'system', content: systemPrompt(pet, memory, mode) },
      ...history.slice(-MAX_HISTORY),
      { role: 'user', content: message ?? openingLine(mode) ?? '' },
    ],
  });
  const verified = await client.verifyResponse(completion.id);
  const { signedText, signature, signer } = verified.signature;
  const hash = createHash('sha256').update(`${signedText}\n${signature}`).digest('hex');
  const usage = completion.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
  return {
    ...settleRound(parseThought(completion.choices[0]?.message.content?.trim() ?? ''), mode, message),
    model,
    usage: { prompt_tokens: usage.prompt_tokens, completion_tokens: usage.completion_tokens },
    proof: { id: completion.id, kind: verified.signatureKind, signer, signedText, signature, hash },
    receipt: `${verified.signatureKind}|${completion.id}|${hash}`.slice(0, 256),
  };
}
