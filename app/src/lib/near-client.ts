// The real OwnlingClient. The player's key is made and kept in this browser; the kitchen's
// sponsor only creates the named account. Pets, food and the encrypted diary live in the
// Ownling contract on NEAR testnet; replies come from the kitchen.
import { Account, JsonRpcProvider } from 'near-api-js';
import { signMessage } from 'near-api-js/nep413';
import { generateSeedPhrase, parseSeedPhrase } from 'near-api-js/seed-phrase';
import { moodFor, runwayDays, stageFor } from '../../../design/mochi/mochi';
import {
  deriveDiaryKey,
  diaryKeyMessage,
  emptyDiary,
  memoryText,
  openDiary,
  remember,
  sealDiary,
  type DiaryEntry,
} from '../../../shared/diary';
import { GUESS_THINGS, sendableTurns, type Mode } from '../../../shared/mind';
import type { OwnlingClient } from './client';
import type { Account as Player, ActiveGame, AppConfig, ChatTurn, DiaryView, PetAction, PetState, Proof, TalkResult } from './types';

const env = import.meta.env;
const RPC_URL: string = env.VITE_RPC_URL ?? 'https://test.rpc.fastnear.com';
const KEY_LOOKUP_URL: string = env.VITE_KEY_LOOKUP_URL ?? 'https://test.api.fastnear.com/v0/public_key';
const STORAGE_KEY = 'ownling.account.v1';
const PLAY_COOLDOWN_MS = 10 * 60 * 1000;
const GAS = 100_000_000_000_000n;
/** Feeding only adds to the budget, which burns a few Tgas. NEAR holds back about 0.1 NEAR per
 * 100 Tgas attached until the call ends, so attaching less lets a smaller balance feed. */
const FEED_GAS = 30_000_000_000_000n;
const ONE_YOCTO = 1n;
const PERSONA = 'A shy, curious cloud creature who loves rain and remembers small kindnesses.';
const MODEL = 'z-ai/glm-5.3-flash';

/** `get_pet` as the contract returns it. */
type PetView = {
  token_id: string; owner_id: string; name: string; species: string; model: string; stage: string;
  budget: string; daily_cap: string; spent_today: string; kitchen: string;
  messages: number; bond: number; last_played_at: string; hibernating: boolean; has_diary: boolean;
  outfit?: string[];
};
type Saved = { accountId: string; secretKey: string; phrase: string };
type TalkResponse = {
  reply: string; model: string; charged: string; verified: boolean;
  remember?: string[]; result?: 'win' | 'lose' | null;
  /** What the owner asked Mochi to open in the app (older kitchens leave it out). */
  action?: PetAction | null;
  /** The pet's food once this reply's charge lands. */
  budget?: string;
  proof: { kind: 'provider_tee' | 'gateway'; hash: string; signer: { signingAddress: string } } | null;
};

/** Below this the pet hibernates (the contract's HIBERNATE_BELOW, 0.0001 NEAR). */
const HIBERNATE_BELOW = 10n ** 20n;
const toNear = (yocto: string | bigint) => Number(BigInt(yocto) / 10n ** 18n) / 1e6;
const toYocto = (near: number) => BigInt(Math.round(near * 1e6)) * 10n ** 18n;

export function createNearClient(): OwnlingClient {
  const config: AppConfig = {
    network: 'testnet',
    contractId: env.VITE_CONTRACT_ID ?? 'pets.ownling.testnet',
    kitchenId: env.VITE_KITCHEN_ID ?? 'kitchen.ownling.testnet',
    // The hosted kitchen serves this app, so a built app calls its own address.
    kitchenUrl: env.VITE_KITCHEN_URL ?? (env.DEV ? 'http://localhost:8787' : ''),
    practiceMode: false,
  };
  const provider = new JsonRpcProvider({ url: RPC_URL });
  let saved: Saved | null = load();
  let signer: Account | null = saved ? accountFor(saved) : null;
  let session: { token: string; expiresAt: number } | null = null;
  let tokenId: string | null = null;
  let diaryKey: CryptoKey | null = null;
  let diaryEntry: DiaryEntry | null = null;
  let turns: ChatTurn[] = [];
  let queue: Promise<unknown> = Promise.resolve();
  let thoughts: Promise<unknown> = Promise.resolve();
  let known: { view: PetView; at: number } | null = null;

  kitchen<{ practiceMode: boolean }>('/health', null, 'GET')
    .then((h) => { config.practiceMode = h.practiceMode; })
    .catch(() => {});

  function accountFor(s: Saved): Account {
    return new Account(s.accountId, provider, s.secretKey as `ed25519:${string}`);
  }

  function signIn(s: Saved): Player {
    saved = s;
    signer = accountFor(s);
    session = null;
    tokenId = null;
    diaryKey = null;
    diaryEntry = null;
    turns = [];
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* private window: this tab only */ }
    return { accountId: s.accountId, kind: 'local' };
  }

  function need(): Account {
    if (!signer || !saved) throw new Error('Sign in first');
    return signer;
  }

  /** Transactions go one at a time, so two never fight over the key's nonce. */
  function call<T>(methodName: string, args: Record<string, unknown>, deposit = 0n, gas = GAS): Promise<T> {
    const run = queue.then(() =>
      need().callFunction({ contractId: config.contractId, methodName, args, deposit, gas }),
    );
    queue = run.catch(() => {});
    return run.then((r) => r as T).catch((err) => { throw friendly(err); });
  }

  function view<T>(method: string, args: Record<string, unknown>): Promise<T> {
    return provider
      .callFunction({ contractId: config.contractId, method, args, blockQuery: { finality: 'optimistic' } })
      .then((r) => r as T);
  }

  function toPet(v: PetView): PetState {
    known = { view: v, at: Date.now() };
    const foodNear = toNear(v.budget);
    const dailyCapNear = toNear(v.daily_cap);
    const growthPoints = v.messages + v.bond;
    const lastPlayed = Number(BigInt(v.last_played_at) / 1_000_000n);
    const readyAt = lastPlayed ? lastPlayed + PLAY_COOLDOWN_MS : 0;
    tokenId = v.token_id;
    return {
      tokenId: v.token_id, name: v.name, species: v.species, ownerId: v.owner_id,
      stage: stageFor(growthPoints), mood: moodFor(foodNear, dailyCapNear), growthPoints,
      messages: v.messages, bond: v.bond, foodNear, dailyCapNear, spentTodayNear: toNear(v.spent_today),
      runwayDays: runwayDays(foodNear, dailyCapNear), hibernating: v.hibernating, hasDiary: v.has_diary,
      kitchen: v.kitchen, model: v.model, contractId: config.contractId,
      playReadyAt: readyAt > Date.now() ? readyAt : null,
      outfit: v.outfit ?? [],
    };
  }

  async function currentPet(): Promise<PetState> {
    const pet = await client.myPet();
    if (!pet) throw new Error('Adopt a pet first');
    return pet;
  }

  /** The pet as last read or worked out here, if recent; saves a chain read before each message. */
  async function recentView(maxAgeMs = 60_000): Promise<PetView> {
    if (!known || Date.now() - known.at > maxAgeMs) await currentPet();
    return known!.view;
  }

  async function sessionToken(): Promise<string> {
    if (session && session.expiresAt > Date.now() + 60_000) return session.token;
    const s = need();
    const issuedAt = new Date().toISOString();
    const nonce = crypto.getRandomValues(new Uint8Array(32));
    const signed = await signMessage({
      signerAccount: s,
      payload: { message: `Sign in to Ownling\nAccount: ${s.accountId}\nIssued: ${issuedAt}`, recipient: 'ownling-kitchen', nonce },
    });
    session = await kitchen('/session', {
      accountId: s.accountId,
      publicKey: signed.publicKey.toString(),
      signature: toBase64(signed.signature),
      nonce: toBase64(nonce),
      issuedAt,
    });
    return session!.token;
  }

  /** The diary key comes from the player's own signature; it never leaves this browser. */
  async function unlock(): Promise<void> {
    if (diaryKey || !tokenId) return;
    const signed = await signMessage({ signerAccount: need(), payload: diaryKeyMessage(config.contractId, tokenId) });
    diaryKey = await deriveDiaryKey(signed.signature, config.contractId, tokenId);
    const stored = await view<{ ciphertext: string } | null>('get_diary', { token_id: tokenId });
    diaryEntry = stored ? await openDiary(diaryKey, stored.ciphertext) : emptyDiary();
    if (!turns.length) {
      const at = Date.parse(diaryEntry.updatedAt) || Date.now();
      turns = sendableTurns(diaryEntry.recent).map((t) => ({ ...t, at }));
    }
  }

  /** Save an exchange, and any facts Mochi learned, to the diary. `said` is null when Mochi spoke first. */
  async function rememberExchange(said: string | null, replied: string, facts: string[]): Promise<void> {
    if (!tokenId) return;
    await unlock();
    if (!diaryKey) return;
    diaryEntry = remember(
      diaryEntry ?? emptyDiary(),
      [...(said ? [{ role: 'user' as const, content: said }] : []), { role: 'assistant', content: replied }],
      facts,
    );
    const sealed = await sealDiary(diaryKey, diaryEntry);
    await call('save_diary', { token_id: tokenId, ciphertext: sealed.ciphertext, hash: sealed.hash });
  }

  /**
   * One thought at a time: the kitchen refuses a second one for the same pet ("still thinking"), so
   * a message sent while the greeting is on its way waits for it, and sees it in the history.
   */
  function think(message: string | null, mode: Mode, onText?: (text: string) => void): Promise<TalkResult> {
    const run = thoughts.then(() => thinkNow(message, mode, onText));
    thoughts = run.catch(() => {});
    return run;
  }

  /** One thought through the kitchen. `message` is null when Mochi speaks first (greet, game start). */
  async function thinkNow(message: string | null, mode: Mode, onText?: (text: string) => void): Promise<TalkResult> {
    const view = await recentView();
    const pet = toPet(view);
    if (pet.hibernating) throw new Error(`${pet.name} is hibernating. Feed it to wake it up.`);
    const token = await sessionToken();
    await unlock().catch(() => {});
    const history = sendableTurns(turns).slice(-12).map(({ role, content }) => ({ role, content }));
    const said: ChatTurn | null = message ? { role: 'user', content: message, at: Date.now() } : null;
    if (said) turns.push(said);
    let res: TalkResponse;
    try {
      res = await kitchenStream({
        tokenId: pet.tokenId, message: message ?? undefined, history, ...mode,
        memory: diaryEntry ? memoryText(diaryEntry) : undefined,
      }, token, onText);
    } catch (err) {
      turns = turns.filter((t) => t !== said);
      throw err;
    }
    const proof: Proof = res.verified && res.proof
      ? { status: 'verified', model: res.model, costNear: toNear(res.charged), receiptHash: res.proof.hash, signer: res.proof.signer.signingAddress, signatureKind: res.proof.kind }
      : { status: 'none', model: res.model, costNear: toNear(res.charged) };
    const learned = (res.remember ?? []).filter((f) => !diaryEntry?.facts.includes(f));
    const reply: ChatTurn = {
      role: 'assistant', content: res.reply, at: Date.now(), proof,
      ...(learned.length ? { learned } : {}), ...(res.result ? { result: res.result } : {}),
      ...(res.action ? { action: res.action } : {}),
    };
    turns.push(reply);
    rememberExchange(message, res.reply, learned).catch(() => {});
    // The kitchen replies before its charge lands, so the pet after this reply is worked out here;
    // the next read from the chain (Home refreshes on open) confirms it.
    const charged = BigInt(res.charged);
    const budget = res.budget ?? (BigInt(view.budget) - charged).toString();
    const next = toPet({
      ...view, budget, messages: view.messages + 1,
      spent_today: (BigInt(view.spent_today) + charged).toString(), hibernating: BigInt(budget) < HIBERNATE_BELOW,
    });
    return { reply, proof, pet: next, learned, result: res.result ?? null, action: res.action ?? null };
  }

  /**
   * /talk, streamed: onText gets the reply so far as Mochi writes it, and the result arrives once
   * the kitchen has checked the signature. A kitchen without streaming gets a plain /talk.
   */
  async function kitchenStream(body: unknown, bearer: string, onText?: (text: string) => void): Promise<TalkResponse> {
    let res: Response;
    try {
      res = await fetch(`${config.kitchenUrl}/talk/stream`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("Can't reach the kitchen right now");
    }
    if (res.status === 404 || !res.body) return kitchen<TalkResponse>('/talk', body, 'POST', bearer);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error ?? `The kitchen answered ${res.status}`);
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let text = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      for (let nl = buffer.indexOf('\n'); nl >= 0; nl = buffer.indexOf('\n')) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line) as { type: string; text?: string; error?: string } & TalkResponse;
        if (msg.type === 'text') {
          text += msg.text ?? '';
          onText?.(text);
        } else if (msg.type === 'done') {
          return msg;
        } else if (msg.type === 'error') {
          throw new Error(msg.error ?? 'Kitchen error');
        }
      }
    }
    throw new Error('The kitchen stopped answering. Try again.');
  }

  async function kitchen<T>(path: string, body: unknown, method = 'POST', bearer?: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${config.kitchenUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
        body: body === null ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error("Can't reach the kitchen right now");
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `The kitchen answered ${res.status}`);
    return json as T;
  }

  const client: OwnlingClient = {
    config,
    account: () => (saved ? { accountId: saved.accountId, kind: 'local' } : null),

    async createAccount() {
      const { seedPhrase, keyPair } = generateSeedPhrase();
      const { accountId } = await kitchen<{ accountId: string }>('/signup', { publicKey: keyPair.getPublicKey().toString() });
      const account = signIn({ accountId, secretKey: keyPair.toString(), phrase: seedPhrase });
      return { account, recoveryPhrase: seedPhrase };
    },

    async restore(recoveryPhrase) {
      const phrase = recoveryPhrase.trim().toLowerCase().split(/\s+/).join(' ');
      if (phrase.split(' ').length !== 12) throw new Error('A recovery phrase has 12 words');
      let keyPair;
      try { keyPair = parseSeedPhrase(phrase); } catch { throw new Error("That phrase isn't valid; check each word"); }
      const publicKey = keyPair.getPublicKey().toString();
      const res = await fetch(`${KEY_LOOKUP_URL}/${publicKey}`).catch(() => null);
      const ids: string[] = res?.ok ? ((await res.json()).account_ids ?? []) : [];
      const accountId = ids.find((id) => id.endsWith(`.${config.contractId.split('.').slice(1).join('.')}`)) ?? ids[0];
      if (!accountId) throw new Error('No account uses this phrase yet. New accounts can take a minute to appear.');
      return signIn({ accountId, secretKey: keyPair.toString(), phrase });
    },

    recoveryPhrase: () => saved?.phrase ?? null,

    signOut() {
      saved = null;
      signer = null;
      session = null;
      tokenId = null;
      diaryKey = null;
      diaryEntry = null;
      turns = [];
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* nothing stored */ }
    },

    async myPet() {
      if (!saved) return null;
      const pets = await view<PetView[]>('pets_for_owner', { account_id: saved.accountId, limit: 1 });
      if (!pets.length) { tokenId = null; return null; }
      const pet = toPet(pets[0]);
      unlock().catch(() => {});
      return pet;
    },

    async adopt(name, depositNear) {
      const v = await call<PetView>('adopt', { name: name.trim(), species: 'cloudling', persona: PERSONA, model: MODEL }, toYocto(depositNear));
      return toPet(v);
    },

    async feed(amountNear) {
      const pet = await currentPet();
      await call('feed', { token_id: pet.tokenId }, toYocto(amountNear), FEED_GAS);
      return currentPet();
    },

    async balance() {
      if (!saved) return null;
      const a = await provider.viewAccount({ accountId: saved.accountId });
      // Storage costs 10^19 yoctoNEAR a byte, and that part can't be spent.
      const free = a.amount - BigInt(a.storage_usage) * 10n ** 19n;
      return free > 0n ? toNear(free) : 0;
    },

    async play() {
      const pet = await currentPet();
      return toPet(await call<PetView>('play', { token_id: pet.tokenId }));
    },

    async dress(outfit) {
      const pet = await currentPet();
      return toPet(await call<PetView>('dress', { token_id: pet.tokenId, outfit }));
    },

    talk: (message, game, onText) =>
      think(message, game ? { kind: 'game', game: game.id, thing: game.thing } : { kind: 'talk' }, onText),

    greet: (onText) => think(null, { kind: 'greet' }, onText),

    async listen(clip) {
      const pet = toPet(await recentView());
      const token = await sessionToken();
      let res: Response;
      try {
        res = await fetch(`${config.kitchenUrl}/listen?name=${encodeURIComponent(pet.name)}`, {
          method: 'POST',
          headers: { 'content-type': clip.type || 'audio/webm', authorization: `Bearer ${token}` },
          body: clip,
        });
      } catch {
        throw new Error("Can't reach the kitchen right now");
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `The kitchen answered ${res.status}`);
      return String(json.text ?? '').trim();
    },

    async startGame(id, onText) {
      const game: ActiveGame = id === 'guess'
        ? { id, thing: GUESS_THINGS[Math.floor(Math.random() * GUESS_THINGS.length)] }
        : { id };
      return { ...(await think(null, { kind: 'game', game: id, thing: game.thing }, onText)), game };
    },

    history: () => [...turns],

    async diary(): Promise<DiaryView> {
      const stored = tokenId ? await view<{ ciphertext: string } | null>('get_diary', { token_id: tokenId }) : null;
      const sizeBytes = stored ? Math.floor((stored.ciphertext.length * 3) / 4) : null;
      if (!diaryKey || !diaryEntry) return { locked: true, facts: [], recent: [], updatedAt: null, sizeBytes };
      const at = Date.parse(diaryEntry.updatedAt) || Date.now();
      return {
        locked: false,
        facts: [...diaryEntry.facts],
        recent: diaryEntry.recent.map((t) => ({ ...t, at })),
        updatedAt: diaryEntry.updatedAt,
        sizeBytes,
      };
    },

    async unlockDiary() {
      if (!tokenId) await currentPet();
      await unlock();
      return client.diary();
    },

    lockDiary() {
      diaryKey = null;
      diaryEntry = null;
    },

    async changeKitchen(kitchenId) {
      const pet = await currentPet();
      await call('set_kitchen', { token_id: pet.tokenId, kitchen: kitchenId.trim() }, ONE_YOCTO);
      return currentPet();
    },

    async give(receiverId) {
      const pet = await currentPet();
      const receiver = receiverId.trim().toLowerCase();
      if (!receiver) throw new Error('Enter the account that receives Mochi');
      await provider.viewAccount({ accountId: receiver }).catch(() => {
        throw new Error(`${receiver} doesn't exist on NEAR testnet`);
      });
      await call('nft_transfer', { receiver_id: receiver, token_id: pet.tokenId }, ONE_YOCTO);
      tokenId = null;
      diaryKey = null;
      diaryEntry = null;
      turns = [];
    },
  };
  return client;
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

/** Contract panics arrive wrapped in RPC detail; keep just the sentence a player can act on. */
function friendly(err: unknown): Error {
  const text = err instanceof Error ? err.message : String(err);
  const panic = /panicked(?: at)?:?\s*(.+?)(?:"|$)/i.exec(text)?.[1] ?? /Smart contract panicked: (.+)/.exec(text)?.[1];
  if (panic) return new Error(panic.replace(/\\n.*/, '').trim());
  const lack = /Not enough balance for \S+ \(balance: (\d+), cost: (\d+)\)/.exec(text);
  if (lack) {
    const has = (Math.floor(toNear(lack[1]) * 1000) / 1000).toFixed(3);
    const needs = (Math.ceil(toNear(lack[2]) * 1000) / 1000).toFixed(3);
    return new Error(`Your account has ${has} testnet NEAR, and this needs ${needs}: the amount plus a little held for the network fee, most of which comes back.`);
  }
  if (/NotEnoughBalance|Not enough balance|LackBalanceForState/i.test(text)) return new Error('Your account is out of testnet NEAR');
  return new Error(text.length > 160 ? 'The transaction failed; try again' : text);
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
