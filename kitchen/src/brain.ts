// A pet's thoughts: an end-to-end-encrypted chat on a NEAR AI TEE model, with the reply's
// signature verified against the attested model before anyone sees it.
import { createHash } from 'node:crypto';
import { InferenceClient } from '@nearai/inference-sdk/node';
import { MAX_HISTORY, MAX_REPLY_TOKENS, systemPrompt } from '../../shared/mind.ts';
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
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number };
  /** Null in practice mode: nothing was verified. */
  proof: Proof | null;
  receipt: string;
};

/** Practice mode (KITCHEN_MOCK=1): canned replies, no AI call, never presented as verified. */
export const PRACTICE_MODE = process.env.KITCHEN_MOCK === '1';
const PRACTICE_REPLIES = [
  '*floats closer* Hello. I was just watching the clouds.',
  'Ooh, tell me more. *wiggles happily*',
  'I like it when you visit. It feels like rain on a warm day.',
  '*yawns softly* I remember you. You are kind.',
];

const client = new InferenceClient({
  baseUrl: config.nearAiBaseUrl,
  apiKey: config.nearAiApiKey,
  e2ee: true,
});

export async function think(
  pet: PetView,
  history: Turn[],
  message: string,
  memory?: string,
): Promise<Thought> {
  if (PRACTICE_MODE) {
    const reply = PRACTICE_REPLIES[(pet.messages + history.length) % PRACTICE_REPLIES.length];
    return {
      reply,
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
      { role: 'system', content: systemPrompt(pet, memory) },
      ...history.slice(-MAX_HISTORY),
      { role: 'user', content: message },
    ],
  });
  const verified = await client.verifyResponse(completion.id);
  const { signedText, signature, signer } = verified.signature;
  const hash = createHash('sha256').update(`${signedText}\n${signature}`).digest('hex');
  const usage = completion.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
  return {
    reply: completion.choices[0]?.message.content?.trim() ?? '',
    model,
    usage: { prompt_tokens: usage.prompt_tokens, completion_tokens: usage.completion_tokens },
    proof: { id: completion.id, kind: verified.signatureKind, signer, signedText, signature, hash },
    receipt: `${verified.signatureKind}|${completion.id}|${hash}`.slice(0, 256),
  };
}
