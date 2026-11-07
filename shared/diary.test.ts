// node --test shared/diary.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveDiaryKey, emptyDiary, memoryText, openDiary, remember, sealDiary } from './diary.ts';

const signature = new Uint8Array(64).fill(7);
const otherSignature = new Uint8Array(64).fill(8);

test('the owner can read back what was sealed', async () => {
  const key = await deriveDiaryKey(signature, 'pets.testnet', '1');
  const entry = remember(emptyDiary(), [
    { role: 'user', content: 'My name is Ada and I love rain.' },
    { role: 'assistant', content: 'Rain! Me too, Ada.' },
  ], ['Owner is called Ada']);
  const { ciphertext, hash } = await sealDiary(key, entry);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(!ciphertext.includes('Ada'), 'ciphertext must not leak plaintext');
  assert.deepEqual(await openDiary(key, ciphertext), entry);
});

test('the same signature always rebuilds the same key', async () => {
  const sealed = await sealDiary(await deriveDiaryKey(signature, 'pets.testnet', '1'), emptyDiary());
  const again = await deriveDiaryKey(signature, 'pets.testnet', '1');
  assert.equal((await openDiary(again, sealed.ciphertext)).v, 1);
});

test('another account, or another pet, cannot read it', async () => {
  const sealed = await sealDiary(await deriveDiaryKey(signature, 'pets.testnet', '1'), emptyDiary());
  await assert.rejects(openDiary(await deriveDiaryKey(otherSignature, 'pets.testnet', '1'), sealed.ciphertext));
  await assert.rejects(openDiary(await deriveDiaryKey(signature, 'pets.testnet', '2'), sealed.ciphertext));
});

test('tampering is detected', async () => {
  const key = await deriveDiaryKey(signature, 'pets.testnet', '1');
  const { ciphertext } = await sealDiary(key, emptyDiary());
  const bytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  bytes[20] ^= 1;
  await assert.rejects(openDiary(key, btoa(String.fromCharCode(...bytes))));
});

test('the diary stays small and memory text is short', () => {
  let entry = emptyDiary();
  for (let i = 0; i < 50; i++) entry = remember(entry, [{ role: 'user', content: `message ${i}` }], [`fact ${i}`]);
  assert.equal(entry.recent.length, 20);
  assert.equal(entry.facts.length, 30);
  assert.equal(remember(entry, [], ['fact 49']).facts.length, 30, 'known facts are not duplicated');
  assert.ok((memoryText(entry) ?? '').length <= 4_000);
  assert.equal(memoryText(emptyDiary()), undefined);
});
