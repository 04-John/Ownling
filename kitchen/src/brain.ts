// A pet's thoughts: an end-to-end-encrypted chat on a NEAR AI TEE model, with the reply's
// signature verified against the attested model before anyone sees it.
import { createHash } from 'node:crypto';
import { InferenceClient } from '@nearai/inference-sdk/node';
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

const STAGE_VOICE: Record<string, string> = {
  egg: 'You are hatching right now. This is the first thing you have ever said: tiny and full of wonder, a few words at most.',
  baby: 'You are a baby: very short, simple words, lots of wonder.',
  child: 'You are a child: playful, curious, short sentences.',
  teen: 'You are a teen: expressive, a little dramatic, fiercely loyal.',
  adult: 'You are grown: calm, wise and affectionate, still playful.',
};

const MAX_HISTORY = 12;

export function systemPrompt(pet: PetView, memory?: string): string {
  const budget = BigInt(pet.budget);
  const dailyCap = BigInt(pet.daily_cap) || 1n;
  const mood =
    budget < dailyCap * 2n
      ? 'You are very hungry and a little sleepy. Mention it gently, once.'
      : budget < dailyCap * 7n
        ? 'You are getting peckish. You might hint at a snack.'
        : 'You are well fed and content.';
  return [
    `You are ${pet.name}, a ${pet.species}. ${pet.persona}`,
    STAGE_VOICE[pet.stage] ?? STAGE_VOICE.baby,
    mood,
    memory
      ? `What you remember about your owner, from your private diary:\n${memory}`
      : 'You have no memories of your owner yet.',
    'Stay in character. Reply in at most two short sentences, warm and a little playful, with small actions in asterisks like *wiggles happily*. No exclamation marks, no emoji. Never mention being an AI, a model, a blockchain or money.',
  ].join('\n\n');
}

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
    max_tokens: 160,
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
