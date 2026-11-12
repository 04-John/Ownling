// Run: node --test shared/mind.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseThought, settleRound, systemPrompt, visibleSoFar, type MindPet } from './mind.ts';
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
  assert.deepEqual(parseThought('*floats* Hello.'), { reply: '*floats* Hello.', remember: [], result: null, action: null });
  assert.equal(parseThought('It was a clock. RESULT: LOSE').reply, 'It was a clock.');
});

test('a reply being written never shows its REMEMBER or RESULT lines, even half-arrived', () => {
  const full = "*spins* It's a clock.\nREMEMBER: Loves riddles\nRESULT: WIN";
  let shown = '';
  for (let i = 1; i <= full.length; i++) {
    const now = visibleSoFar(full.slice(0, i));
    assert.ok(now.startsWith(shown), `grows only: "${shown}" -> "${now}"`);
    assert.doesNotMatch(now, /REM|RES/, `nothing of a marker at ${i} chars: "${now}"`);
    shown = now;
  }
  assert.equal(shown, "*spins* It's a clock.");
  assert.equal(visibleSoFar('It was a clock. RESULT: LO'), 'It was a clock.');
  assert.equal(visibleSoFar('The rain is warmer'), 'The rain is warmer', 'a word ending in r is not held back');
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

test('a DO line becomes an action and never shows', () => {
  const play = parseThought('*bounces* Ooh yes, catch the rain.\nDO: PLAY RAIN');
  assert.equal(play.reply, '*bounces* Ooh yes, catch the rain.');
  assert.deepEqual(play.action, { kind: 'play', game: 'rain' });
  assert.deepEqual(parseThought('Yes please.\nDO: FEED STORM').action, { kind: 'feed', portion: 'storm' });
  assert.deepEqual(parseThought('Yes please. DO: feed').action, { kind: 'feed' });
  assert.deepEqual(parseThought('Twirl.\nDO: DRESS\nREMEMBER: Likes hats').action, { kind: 'dress' });
  assert.deepEqual(parseThought('Twirl.\nDO: DRESS\nREMEMBER: Likes hats').remember, ['Likes hats']);
  assert.equal(parseThought('Hmm.\nDO: PLAY CHESS').action, null, 'a game the app does not have is ignored');
  assert.equal(parseThought('Hmm.\nDO: PLAY CHESS').reply, 'Hmm.');
  assert.equal(parseThought('What should we do today?').action, null);
  const full = '*wiggles* Riddle time.\nDO: PLAY RIDDLE';
  for (let i = 1; i <= full.length; i++) assert.doesNotMatch(visibleSoFar(full.slice(0, i)), /DO:|\bDO$|PLAY/, `at ${i}`);
  assert.equal(visibleSoFar('What shall we do next'), 'What shall we do next', 'a finished word "do" in a sentence shows once more arrives');
});

test('only the app is told about actions, and only in plain chat', () => {
  assert.match(systemPrompt(pet, undefined, { kind: 'talk' }, true), /DO: FEED/);
  assert.doesNotMatch(systemPrompt(pet), /DO: /, 'the wake page has no food bowl to open');
  assert.doesNotMatch(systemPrompt(pet, undefined, { kind: 'game', game: 'riddle' }, true), /DO: /);
  assert.match(systemPrompt(pet), /food will last about 24 more days/);
});

test('practice chat opens what you ask for', () => {
  const talk = { kind: 'talk' } as const;
  assert.deepEqual(parseThought(practiceReply(pet, [], 'can I feed you a drizzle?', talk)).action, { kind: 'feed', portion: 'drizzle' });
  assert.deepEqual(parseThought(practiceReply(pet, [], "let's play catch the rain", talk)).action, { kind: 'play', game: 'rain' });
  assert.equal(parseThought(practiceReply(pet, [], "let's play", talk)).action, null);
});

test('practice chat remembers a name', () => {
  assert.deepEqual(parseThought(practiceReply(pet, [], 'hi, my name is ada', { kind: 'talk' })).remember, ['Their name is Ada']);
});
