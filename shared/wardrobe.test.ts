// Run: node --test shared/wardrobe.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEMS, isUnlocked, itemById, newlyUnlocked, outfitSvg, unlockText } from './wardrobe.ts';

test('every item has a known slot, a grown stage and art', () => {
  assert.equal(ITEMS.length, 9);
  for (const i of ITEMS) {
    assert.ok(['hat', 'scarf', 'item'].includes(i.slot), i.id);
    assert.ok(['baby', 'child', 'teen', 'adult'].includes(i.stage), i.id);
    assert.ok(i.svg.startsWith('<') && !i.svg.includes('"'), `${i.id} art uses single quotes, so the contract can embed it`);
  }
});

test('items unlock by bond and by stage, as the contract checks', () => {
  const party = itemById('party-hat')!;
  const crown = itemById('flower-crown')!;
  assert.equal(isUnlocked(party, { bond: 2, stage: 'teen' }), false);
  assert.equal(isUnlocked(party, { bond: 3, stage: 'baby' }), true);
  assert.equal(isUnlocked(crown, { bond: 50, stage: 'baby' }), false);
  assert.equal(isUnlocked(crown, { bond: 0, stage: 'child' }), true);
  assert.equal(isUnlocked(itemById('rain-hat')!, { bond: 0, stage: 'egg' }), false, 'eggs wear nothing');
  assert.equal(unlockText(party, 'Mochi'), 'Win games until your bond is 3');
  assert.equal(unlockText(itemById('crown')!, 'Mochi'), 'Unlocks when Mochi is an adult');
});

test('newlyUnlocked names what a win or growing up just opened', () => {
  assert.deepEqual(newlyUnlocked({ bond: 2, stage: 'baby' }, { bond: 3, stage: 'baby' }).map((i) => i.id), ['party-hat']);
  assert.deepEqual(newlyUnlocked({ bond: 3, stage: 'baby' }, { bond: 3, stage: 'child' }).map((i) => i.id), ['flower-crown']);
});

test('outfits sit on the slot anchors in the same form the contract writes', () => {
  assert.match(outfitSvg('baby', ['rain-hat']), /^<g data-layer="outfit\/rain-hat" transform="translate\(104 80\) scale\(0\.78\)"><path/);
  assert.equal(outfitSvg('egg', ['rain-hat']), '');
});
