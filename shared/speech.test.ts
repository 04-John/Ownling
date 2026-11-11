// Run: node --test shared/speech.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixName } from './speech.ts';

test("a capitalized word one letter off the pet's name becomes the name", () => {
  assert.equal(fixName('Hello Moshi, my name is Ada.', 'Mochi'), 'Hello Mochi, my name is Ada.');
  assert.equal(fixName('Mochie, are you there?', 'Mochi'), 'Mochi, are you there?');
});

test('ordinary words and short names are left alone', () => {
  assert.equal(fixName('it rains and mocha is nice', 'Rain'), 'it rains and mocha is nice');
  assert.equal(fixName('Hello Bob', 'Bo'), 'Hello Bob');
  assert.equal(fixName('Hello Moshi', undefined), 'Hello Moshi');
});
