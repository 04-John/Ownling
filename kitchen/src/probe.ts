// One verified, end-to-end-encrypted message to a NEAR AI TEE model, to measure latency,
// token usage and the shape of the signed receipt.
// Usage: node --env-file=../.env src/probe.ts [model]
import { InferenceClient } from '@nearai/inference-sdk/node';

const apiKey = process.env.NEAR_AI_API_KEY;
if (!apiKey) throw new Error('NEAR_AI_API_KEY is missing from .env');

const model = process.argv[2] ?? 'z-ai/glm-5.3-flash';
const client = new InferenceClient({ baseUrl: 'https://cloud-api.near.ai/v1', apiKey, e2ee: true });

const started = Date.now();
const completion = await client.chat.completions.create({
  model,
  max_tokens: 150,
  // GLM-5.3 Flash reasons by default; "low" keeps it to a few tokens, which a pet's chat doesn't need.
  reasoning_effort: 'low',
  messages: [
    {
      role: 'system',
      content:
        'You are Mochi, a small cloudling: a shy, curious cloud creature who loves rain and remembers small kindnesses. ' +
        'Reply in one or two short sentences, warm and a little playful. Never mention being an AI.',
    },
    { role: 'user', content: 'Hi Mochi! How are you today?' },
  ],
});
const answered = Date.now();
const receipt = await client.verifyResponse(completion.id);

console.log(JSON.stringify({
  model,
  reply: completion.choices[0]?.message.content,
  usage: completion.usage,
  answerMs: answered - started,
  verifyMs: Date.now() - answered,
  id: completion.id,
  signatureKind: receipt.signatureKind,
  signer: receipt.signature.signer,
  signedText: receipt.signature.signedText,
}, null, 2));
