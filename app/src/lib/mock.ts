// A stand-in OwnlingClient with sample data and short delays, so screens can be built and
// reviewed without the chain or the kitchen. Enabled with VITE_MOCK=1.
import { moodFor, runwayDays, stageFor } from '../../../design/mochi/mochi';
import { GUESS_THINGS, parseThought, type Mode } from '../../../shared/mind';
import { practiceReply } from '../../../shared/practice';
import { isUnlocked, itemById } from '../../../shared/wardrobe';
import type { OwnlingClient } from './client';
import type { Account, ActiveGame, ChatTurn, DiaryView, PetState, Proof, TalkResult } from './types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fail = (message: string): never => {
  throw new Error(message);
};
const PLAY_COOLDOWN_MS = 10 * 60 * 1000;
const PHRASE = 'river cloud gentle orbit maple quiet lantern drift echo velvet harbor bloom';

/** Dev-only starting states for reviewing screens by URL: ?preset=<name>#/route (mock mode only). */
export const MOCK_PRESETS = [
  'account', 'home-egg', 'home-baby', 'almost-child', 'home-child', 'home-teen', 'home-adult',
  'peckish', 'hungry', 'hibernating', 'resting', 'chat', 'chat-practice', 'diary', 'diary-locked', 'wallet',
] as const;

export function createMockClient(preset?: string | null): OwnlingClient {
  let account: Account | null = null;
  let pet: PetState | null = null;
  let diaryLocked = true;
  let lastPlayed = 0;
  const turns: ChatTurn[] = [];
  // Dev presets may seed these; the defaults are what the mock always used.
  let practiceMode = true;
  let facts = ['Owner loves rainy evenings'];
  let diarySizeBytes = 360;

  /** The practice mind's reply (shared/practice.ts), charged like the practice kitchen does. */
  async function think(message: string | null, mode: Mode): Promise<TalkResult> {
    const p = need();
    if (p.hibernating) throw new Error(`${p.name} is hibernating. Feed it to wake it up.`);
    const history = turns.slice(-12).map(({ role, content }) => ({ role, content }));
    if (message) turns.push({ role: 'user', content: message, at: Date.now() });
    await wait(1600);
    const thought = parseThought(practiceReply(p, history, message, mode));
    const learned = thought.remember.filter((f) => !facts.includes(f));
    facts = [...facts, ...learned];
    const cost = 0.000001;
    const proof: Proof = { status: 'none', model: 'practice', costNear: cost };
    const reply: ChatTurn = {
      role: 'assistant', content: thought.reply, at: Date.now(), proof,
      ...(learned.length ? { learned } : {}), ...(thought.result ? { result: thought.result } : {}),
    };
    turns.push(reply);
    pet = refresh({ ...p, messages: p.messages + 1, foodNear: p.foodNear - cost, spentTodayNear: p.spentTodayNear + cost, hasDiary: true });
    return { reply, proof, pet, learned, result: thought.result };
  }

  const refresh = (p: PetState): PetState => {
    const growthPoints = p.messages + p.bond;
    return {
      ...p,
      growthPoints,
      stage: stageFor(growthPoints),
      mood: moodFor(p.foodNear, p.dailyCapNear),
      runwayDays: runwayDays(p.foodNear, p.dailyCapNear),
      hibernating: p.foodNear < 0.0001,
      playReadyAt: lastPlayed && Date.now() < lastPlayed + PLAY_COOLDOWN_MS ? lastPlayed + PLAY_COOLDOWN_MS : null,
    };
  };
  const need = (): PetState => {
    if (!pet) throw new Error('Adopt a pet first');
    return pet;
  };

  if (preset) {
    const seedPet = (messages: number, bond: number, foodNear = 0.46): PetState =>
      refresh({
        tokenId: '1', name: 'Mochi', species: 'cloudling', ownerId: 'cloud-4821.ownling.testnet',
        stage: 'egg', mood: 'content', growthPoints: 0, messages, bond,
        foodNear, dailyCapNear: 0.02, spentTodayNear: 0,
        runwayDays: null, hibernating: false, hasDiary: messages > 0,
        kitchen: 'kitchen.ownling.testnet', model: 'z-ai/glm-5.3-flash',
        contractId: 'pets.ownling.testnet', playReadyAt: null, outfit: [],
      });
    const verified = (receiptHash: string): Proof => ({
      status: 'verified', model: 'z-ai/glm-5.3-flash', costNear: 0.000024, receiptHash, signatureKind: 'provider_tee',
    });
    const today = new Date();
    today.setHours(8, 12, 0, 0);
    const t0 = Math.min(today.getTime(), Date.now() - 60_000);
    const chat = (proofFor: (hash: string) => Proof): ChatTurn[] => [
      { role: 'user', content: 'Good morning, Mochi.', at: t0 },
      { role: 'assistant', content: '*stretches* Morning. It rained in my dream.', at: t0 + 4_000, proof: proofFor('8b21d4e07c9a4f3e8d6b2a1c5e7f9038a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4') },
      { role: 'user', content: 'What do you remember about me?', at: t0 + 40_000 },
      { role: 'assistant', content: '*hides a little* You named me on a rainy day. You always say goodnight.', at: t0 + 44_000, proof: proofFor('3f9a7b2c1d0e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091ac21e') },
    ];
    account = { accountId: 'cloud-4821.ownling.testnet', kind: preset === 'wallet' ? 'wallet' : 'local' };
    switch (preset) {
      case 'account': break;
      case 'home-egg': pet = seedPet(0, 0, 0.4894); break;
      case 'home-baby': pet = seedPet(6, 2); break;
      case 'almost-child': pet = seedPet(17, 2); break;
      case 'home-teen': pet = seedPet(110, 10); break;
      case 'home-adult': pet = seedPet(210, 24); break;
      case 'peckish': pet = seedPet(30, 4, 0.1); break;
      case 'hungry': pet = seedPet(30, 4, 0.03); break;
      case 'hibernating': pet = seedPet(30, 4, 0); break;
      case 'resting': lastPlayed = Date.now() - 2_000; pet = seedPet(30, 4); break;
      case 'chat': practiceMode = false; turns.push(...chat(verified)); pet = seedPet(30, 4); break;
      case 'chat-practice': turns.push(...chat(() => ({ status: 'none', model: 'practice', costNear: 0.000001 }))); pet = seedPet(30, 4); break;
      case 'diary':
      case 'diary-locked':
        diaryLocked = preset === 'diary-locked';
        diarySizeBytes = 2150;
        facts = [
          'You named me Mochi. It was raining.',
          'You like the word "drizzle". So do I.',
          'You said goodnight. Four nights now.',
          'You have an exam on Friday. Ask how it went.',
          'We watched the rain. Best day.',
        ];
        pet = seedPet(30, 4);
        break;
      default: pet = seedPet(30, 4); // home-child, wallet and anything else
    }
  }

  return {
    config: {
      network: 'testnet',
      contractId: 'pets.ownling.testnet',
      kitchenId: 'kitchen.ownling.testnet',
      kitchenUrl: 'http://localhost:8787',
      practiceMode,
    },
    account: () => account,
    async createAccount() {
      await wait(900);
      account = { accountId: 'cloud-4821.ownling.testnet', kind: 'local' };
      return { account, recoveryPhrase: PHRASE };
    },
    async restore(phrase) {
      await wait(600);
      if (phrase.trim().split(/\s+/).length !== 12) throw new Error('A recovery phrase has 12 words');
      account = { accountId: 'cloud-4821.ownling.testnet', kind: 'local' };
      return account;
    },
    recoveryPhrase: () => (account?.kind === 'local' ? PHRASE : null),
    signOut() {
      account = null;
      pet = null;
      turns.length = 0;
    },
    async myPet() {
      await wait(300);
      return pet ? (pet = refresh(pet)) : null;
    },
    async adopt(name, depositNear) {
      await wait(1200);
      pet = refresh({
        tokenId: '1', name, species: 'cloudling', ownerId: account?.accountId ?? '',
        stage: 'egg', mood: 'content', growthPoints: 0, messages: 0, bond: 0,
        foodNear: depositNear - 0.0106, dailyCapNear: 0.02, spentTodayNear: 0,
        runwayDays: null, hibernating: false, hasDiary: false,
        kitchen: 'kitchen.ownling.testnet', model: 'z-ai/glm-5.3-flash',
        contractId: 'pets.ownling.testnet', playReadyAt: null, outfit: [],
      });
      return pet;
    },
    async feed(amountNear) {
      await wait(1000);
      const p = need();
      return (pet = refresh({ ...p, foodNear: p.foodNear + amountNear }));
    },
    async play() {
      await wait(700);
      const p = need();
      if (p.playReadyAt) throw new Error(`${p.name} needs a rest before playing again`);
      lastPlayed = Date.now();
      return (pet = refresh({ ...p, bond: p.bond + 1 }));
    },
    async dress(outfit) {
      await wait(900);
      const p = need();
      const items = outfit.map((id) => itemById(id) ?? fail(`There is no item called ${id}`));
      if (new Set(items.map((i) => i.slot)).size !== items.length) fail('One item per slot');
      const locked = items.find((i) => !isUnlocked(i, p));
      if (locked) fail(`${locked.id} isn't unlocked yet`);
      return (pet = refresh({ ...p, outfit: [...outfit] }));
    },
    talk: (message, game) => think(message, game ? { kind: 'game', game: game.id, thing: game.thing } : { kind: 'talk' }),
    greet: () => think(null, { kind: 'greet' }),
    async startGame(id) {
      const game: ActiveGame = id === 'guess' ? { id, thing: GUESS_THINGS[Math.floor(Math.random() * GUESS_THINGS.length)] } : { id };
      return { ...(await think(null, { kind: 'game', game: id, thing: game.thing })), game };
    },
    history: () => [...turns],
    async diary(): Promise<DiaryView> {
      await wait(200);
      return diaryLocked
        ? { locked: true, facts: [], recent: [], updatedAt: null, sizeBytes: pet?.hasDiary ? diarySizeBytes : null }
        : { locked: false, facts: [...facts], recent: turns.slice(-6), updatedAt: new Date().toISOString(), sizeBytes: diarySizeBytes };
    },
    async unlockDiary() {
      await wait(500);
      diaryLocked = false;
      return this.diary();
    },
    lockDiary() {
      diaryLocked = true;
    },
    async changeKitchen(kitchenId) {
      await wait(900);
      return (pet = refresh({ ...need(), kitchen: kitchenId }));
    },
    async give(receiverId) {
      await wait(1000);
      if (!receiverId.trim()) throw new Error('Enter the account that receives Mochi');
      pet = null;
    },
  };
}
