// Development check of a brand-new player's whole journey against a running kitchen: make a key
// locally, sign up, adopt, sign in, talk, and read the wallet picture. Mirrors what the app does.
// Usage: node --env-file=../.env src/dev-player.ts   (DEV_PHRASE_OUT=<file> also saves the test
// account's phrase there, for browser tests; testnet only, never inside the repo)
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { Account } from 'near-api-js';
import { signMessage } from 'near-api-js/nep413';
import { generateSeedPhrase } from 'near-api-js/seed-phrase';
import { provider } from './chain.ts';
import { config } from './config.ts';

const KITCHEN_URL = process.env.KITCHEN_URL ?? 'http://localhost:8787';
const NEAR = 10n ** 24n;

const { seedPhrase, keyPair } = generateSeedPhrase();
const publicKey = keyPair.getPublicKey().toString();
console.log(`phrase has ${seedPhrase.split(' ').length} words; public key ${publicKey}`);

const { accountId } = await post('/signup', { publicKey });
console.log(`signed up as ${accountId}`);
if (process.env.DEV_PHRASE_OUT) writeFileSync(process.env.DEV_PHRASE_OUT, JSON.stringify({ accountId, seedPhrase }));
const player = new Account(accountId, provider, keyPair.toString() as `ed25519:${string}`);

const pet = (await player.callFunction({
  contractId: config.petsContract,
  methodName: 'adopt',
  args: { name: 'Mochi', species: 'cloudling', persona: 'A shy, curious cloud creature who loves rain and remembers small kindnesses.', model: 'z-ai/glm-5.3-flash' },
  deposit: NEAR / 2n,
  gas: 100_000_000_000_000n,
})) as { token_id: string; budget: string; stage: string };
console.log(`adopted pet #${pet.token_id}: stage ${pet.stage}, food ${Number(BigInt(pet.budget) / 10n ** 18n) / 1e6} NEAR`);

const issuedAt = new Date().toISOString();
const nonce = new Uint8Array(randomBytes(32));
const signed = await signMessage({
  signerAccount: player,
  payload: { message: `Sign in to Ownling\nAccount: ${accountId}\nIssued: ${issuedAt}`, recipient: 'ownling-kitchen', nonce },
});
const session = await post('/session', {
  accountId,
  publicKey: signed.publicKey.toString(),
  signature: Buffer.from(signed.signature).toString('base64'),
  nonce: Buffer.from(nonce).toString('base64'),
  issuedAt,
});
const talk = await post('/talk', { tokenId: pet.token_id, message: 'Hello Mochi' }, session.token);
console.log(`Mochi: ${talk.reply} (verified: ${talk.verified})`);

const token = (await provider.callFunction({
  contractId: config.petsContract,
  method: 'nft_token',
  args: { token_id: pet.token_id },
})) as { metadata: { media: string } };
console.log(`wallet picture: ${token.metadata.media.slice(0, 40)}… (${token.metadata.media.length} chars)`);

async function post(path: string, body: unknown, bearer?: string) {
  const res = await fetch(`${KITCHEN_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${json.error}`);
  return json;
}
