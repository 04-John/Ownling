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
