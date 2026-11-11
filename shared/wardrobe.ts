// Mochi's wardrobe: outfits a pet earns by winning games (bond) and growing up (stage). The items,
// their unlock rules, their art and where each slot sits at every stage live in wardrobe.json,
// which the contract also reads (include_str!), so the app draws exactly what the contract allows
// and what the wallet picture shows.
import wardrobe from './wardrobe.json' with { type: 'json' };

export type Slot = 'hat' | 'scarf' | 'item';
export type GrownStage = 'baby' | 'child' | 'teen' | 'adult';
export type Item = { id: string; name: string; slot: Slot; bond: number; stage: GrownStage; svg: string };

export const ITEMS = wardrobe.items as Item[];
export const SLOTS: { slot: Slot; title: string }[] = [
  { slot: 'hat', title: 'Hats' },
  { slot: 'scarf', title: 'Scarves' },
  { slot: 'item', title: 'Things to hold' },
];

const ANCHORS = wardrobe.anchors as Record<GrownStage, { scale: number } & Record<Slot, [number, number]>>;
const STAGE_RANK: Record<string, number> = { egg: 0, baby: 1, child: 2, teen: 3, adult: 4 };

export const itemById = (id: string): Item | undefined => ITEMS.find((i) => i.id === id);

/** Whether a pet with this bond and stage may wear the item (the contract checks the same rule). */
export const isUnlocked = (item: Item, pet: { bond: number; stage: string }): boolean =>
  pet.bond >= item.bond && (STAGE_RANK[pet.stage] ?? 0) >= STAGE_RANK[item.stage];

/** "Win games until your bond is 3" or "Unlocks when Mochi is a child". */
export function unlockText(item: Item, name: string): string {
  if (item.stage !== 'baby') return `Unlocks when ${name} is ${item.stage === 'adult' ? 'an adult' : `a ${item.stage}`}`;
  return item.bond ? `Win games until your bond is ${item.bond}` : 'Free';
}

/** Items that became wearable between two states of the same pet, for "New outfit unlocked". */
export function newlyUnlocked(before: { bond: number; stage: string }, after: { bond: number; stage: string }): Item[] {
  return ITEMS.filter((i) => !isUnlocked(i, before) && isUnlocked(i, after));
}

/** The outfit as SVG, positioned on Mochi's slots for its stage (viewBox 0 0 200 200). Eggs wear nothing. */
export function outfitSvg(stage: string, outfit: readonly string[]): string {
  const a = ANCHORS[stage as GrownStage];
  if (!a) return '';
  return outfit
    .map(itemById)
    .filter((i): i is Item => !!i)
    .map((i) => `<g data-layer="outfit/${i.id}" transform="translate(${a[i.slot][0]} ${a[i.slot][1]}) scale(${a.scale})">${i.svg}</g>`)
    .join('');
}

/** A small picture of one item on its own, for the wardrobe's buttons. */
export function itemPreviewSvg(item: Item, size: number): string {
  const box = item.slot === 'hat' ? '-30 -32 60 46' : item.slot === 'scarf' ? '-38 -14 76 40' : '-34 -64 52 80';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="${size}" height="${size}" aria-hidden="true">${item.svg}</svg>`;
}
