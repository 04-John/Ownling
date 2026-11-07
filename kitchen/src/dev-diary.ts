// Development check of the private diary against the real chain: derive the key from an owner's
// signature (twice, to prove it's stable), seal a diary entry, save it on-chain, read it back.
// Usage: node --env-file=../.env src/dev-diary.ts <credentials.json> <token_id>
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { Account } from 'near-api-js';
import { signMessage } from 'near-api-js/nep413';
import {
  deriveDiaryKey,
  diaryKeyMessage,
  emptyDiary,
  memoryText,
  openDiary,
  remember,
  sealDiary,
} from '../../shared/diary.ts';
import { provider } from './chain.ts';
import { config } from './config.ts';

const [credsPath, tokenId] = process.argv.slice(2);
if (!credsPath || !tokenId) {
  console.error('Usage: node --env-file=../.env src/dev-diary.ts <credentials.json> <token_id>');
  process.exit(1);
}
const creds = JSON.parse(readFileSync(credsPath, 'utf8')) as { private_key: string };
const owner = new Account(basename(credsPath, '.json'), provider, creds.private_key as `ed25519:${string}`);

const payload = diaryKeyMessage(config.petsContract, tokenId);
const first = await signMessage({ signerAccount: owner, payload });
const second = await signMessage({ signerAccount: owner, payload });
const stable = Buffer.from(first.signature).equals(Buffer.from(second.signature));
console.log(`signature stable across signings: ${stable}`);

const key = await deriveDiaryKey(first.signature, config.petsContract, tokenId);
const entry = remember(
  emptyDiary(),
  [
    { role: 'user', content: 'Hi Mochi, I am your owner. I love rainy evenings.' },
    { role: 'assistant', content: 'Rainy evenings! I will remember.' },
  ],
  ['Owner loves rainy evenings'],
);
const sealed = await sealDiary(key, entry);
await owner.callFunction({
  contractId: config.petsContract,
  methodName: 'save_diary',
  args: { token_id: tokenId, ciphertext: sealed.ciphertext, hash: sealed.hash },
  gas: 30_000_000_000_000n,
});
console.log(`saved ${sealed.ciphertext.length} chars of ciphertext on-chain, hash ${sealed.hash.slice(0, 16)}…`);

const onChain = (await provider.callFunction({
  contractId: config.petsContract,
  method: 'get_diary',
  args: { token_id: tokenId },
})) as { ciphertext: string; hash: string } | null;
if (!onChain) throw new Error('No diary on-chain');
console.log(`on-chain hash matches: ${onChain.hash === sealed.hash}`);
console.log(`ciphertext readable without the key: ${onChain.ciphertext.includes('rainy')}`);

const rebuilt = await deriveDiaryKey(second.signature, config.petsContract, tokenId);
console.log('decrypted with a freshly rebuilt key:\n' + memoryText(await openDiary(rebuilt, onChain.ciphertext)));
