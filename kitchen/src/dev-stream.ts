// How soon a streamed, end-to-end-encrypted reply shows its first words, against the whole reply.
// Usage: node --env-file=../.env src/dev-stream.ts
import { InferenceClient } from '@nearai/inference-sdk/node';
import { config } from './config.ts';

const client = new InferenceClient({ baseUrl: config.nearAiBaseUrl, apiKey: config.nearAiApiKey, e2ee: true });
for (let i = 0; i < 4; i++) {
  const t0 = Date.now();
  let first = 0;
  let text = '';
  let id = '';
  const stream = await client.chat.completions.create({
    model: config.defaultModel, max_tokens: 120, reasoning_effort: 'low', stream: true, stream_options: { include_usage: true },
    messages: [{ role: 'system', content: 'You are a small cloud pet. Two short sentences.' }, { role: 'user', content: `Tell me about your day (${i})` }],
  } as never);
  let usage: unknown = null;
  for await (const chunk of stream as AsyncIterable<{ id: string; usage?: unknown; choices: { delta?: { content?: string } }[] }>) {
    if (chunk.usage) usage = chunk.usage;
    id = chunk.id || id;
    const piece = chunk.choices[0]?.delta?.content ?? '';
    if (piece && !first) first = Date.now() - t0;
    text += piece;
  }
  const whole = Date.now() - t0;
  const v = Date.now();
  const verified = await client.verifyResponse(id).then((r) => r.signatureKind).catch((e) => `failed: ${(e as Error).message.slice(0, 50)}`);
  console.log(`#${i + 1}: first words ${first} ms, whole reply ${whole} ms, verify ${Date.now() - v} ms (${verified}), ${text.length} chars, usage ${JSON.stringify(usage)}`);
}
