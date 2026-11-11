// Where a reply's time goes: NEAR AI's answer, the signature check, and the on-chain charge, each
// timed separately on a warm connection. Charges the test pet a tiny practice amount.
// Usage: node --env-file=../.env src/dev-timing.ts <token_id> [model]
import { InferenceClient } from '@nearai/inference-sdk/node';
import { charge } from './chain.ts';
import { config } from './config.ts';

const [tokenId, model = config.defaultModel] = process.argv.slice(2);
const client = new InferenceClient({ baseUrl: config.nearAiBaseUrl, apiKey: config.nearAiApiKey, e2ee: true });

for (let i = 0; i < 4; i++) {
  const t0 = Date.now();
  const c = await client.chat.completions.create({
    model, max_tokens: 120, reasoning_effort: 'low',
    messages: [{ role: 'system', content: 'You are a small cloud pet. Two short sentences.' }, { role: 'user', content: `How was your day? (${i})` }],
  } as never);
  const t1 = Date.now();
  await client.verifyResponse(c.id);
  const t2 = Date.now();
  if (tokenId) await charge(tokenId, 10n ** 18n, `timing|${c.id}`);
  const t3 = Date.now();
  console.log(`${model} #${i + 1}: answer ${t1 - t0} ms, verify ${t2 - t1} ms, charge ${t3 - t2} ms, tokens out ${c.usage?.completion_tokens}`);
}
