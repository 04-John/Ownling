// Run: node --test shared/mind.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseThought, settleRound, systemPrompt, type MindPet } from './mind.ts';
import { practiceReply } from './practice.ts';

const pet: MindPet & { messages: number } = {
  name: 'Mochi', species: 'cloudling', persona: 'A shy cloud.', stage: 'baby',
  budget: '490000000000000000000000', daily_cap: '20000000000000000000000', messages: 0,
};

test('parseThought keeps the reply and takes out what the app keeps', () => {
  const t = parseThought('*spins* You got it. It was a towel.\nREMEMBER: Loves riddles\nRESULT: WIN');
  assert.equal(t.reply, '*spins* You got it. It was a towel.');
  assert.deepEqual(t.remember, ['Loves riddles']);
  assert.equal(t.result, 'win');
});

test('parseThought handles a plain reply and a result on the same line', () => {
  assert.deepEqual(parseThought('*floats* Hello.'), { reply: '*floats* Hello.', remember: [], result: null });
  assert.equal(parseThought('It was a clock. RESULT: LOSE').reply, 'It was a clock.');
});

test('giving up ends a game round even when the model forgets the RESULT line', () => {
  const forgot = parseThought("*puffs* It's a clock. It has hands but never claps.");
  assert.equal(settleRound(forgot, { kind: 'game', game: 'riddle' }, 'I give up').result, 'lose');
  assert.equal(settleRound(forgot, { kind: 'game', game: 'riddle' }, 'is it a watch?').result, null);
  assert.equal(settleRound(forgot, { kind: 'talk' }, 'I give up').result, null);
});

test('the prompt carries the mode rules, and the guessing game names its thing', () => {
  assert.match(systemPrompt(pet, undefined, { kind: 'greet' }), /you speak first/);
  assert.match(systemPrompt(pet, undefined, { kind: 'game', game: 'guess', thing: 'a kite' }), /thinking of a kite/);
  assert.doesNotMatch(systemPrompt(pet), /RESULT: WIN/);
});

test('practice riddles: ask, hint, then win', () => {
  const asked = practiceReply(pet, [], null, { kind: 'game', game: 'riddle' });
  const history = [{ role: 'assistant' as const, content: asked }];
  assert.match(practiceReply(pet, history, 'a door', { kind: 'game', game: 'riddle' }), /hint/);
  assert.equal(parseThought(practiceReply(pet, history, 'a piano', { kind: 'game', game: 'riddle' })).result, 'win');
});

test('practice would-you-rather remembers the choice', () => {
  const asked = practiceReply(pet, [], null, { kind: 'game', game: 'rather' });
  const t = parseThought(practiceReply(pet, [{ role: 'assistant', content: asked }], 'swim like a fish', { kind: 'game', game: 'rather' }));
  assert.deepEqual(t.remember, ['Would rather swim like a fish']);
  assert.equal(t.result, 'win');
});

test('practice chat remembers a name', () => {
  assert.deepEqual(parseThought(practiceReply(pet, [], 'hi, my name is ada', { kind: 'talk' })).remember, ['Their name is Ada']);
});
