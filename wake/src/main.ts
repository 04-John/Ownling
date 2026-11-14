// The wake-anywhere client. Everything here talks to NEAR and NEAR AI directly: the pet is read
// from its contract, the diary is unlocked with a key rebuilt from the owner's own signature, and
// replies come from NEAR AI's secure hardware, paid with the owner's own key. No Ownling server.
import '@fontsource/schibsted-grotesk/400.css';
import '@fontsource/schibsted-grotesk/600.css';
import '@fontsource/schibsted-grotesk/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '../../design/tokens.css';
import './style.css';
import { InferenceClient } from '@nearai/inference-sdk';
import { Account, JsonRpcProvider } from 'near-api-js';
import { signMessage } from 'near-api-js/nep413';
import { parseSeedPhrase } from 'near-api-js/seed-phrase';
import { MOCHI_CSS, moodFor, renderMochi, stageFor, type Moment } from '../../design/mochi/mochi';
import { outfitSvg } from '../../shared/wardrobe';
import { deriveDiaryKey, diaryKeyMessage, emptyDiary, memoryText, openDiary, remember, sealDiary, type DiaryEntry } from '../../shared/diary';
import { DEFAULT_MODEL, MAX_HISTORY, MAX_REPLY_TOKENS, parseThought, systemPrompt, type MindPet } from '../../shared/mind';

const params = new URLSearchParams(location.search);
const CONTRACT = params.get('contract') ?? 'pets.ownling.testnet';
const RPC_URL = params.get('rpc') ?? 'https://test.rpc.fastnear.com';
/** The Ownling kitchen. Only checked, to show whether it's off; never used. */
const APP_URL = params.get('app') ?? 'https://ownling.onrender.com';
const NEAR_AI = 'https://cloud-api.near.ai/v1';
const KEY_LOOKUP = 'https://test.api.fastnear.com/v0/public_key';
const GAS = 100_000_000_000_000n;
const MODEL_NAMES: Record<string, string> = { 'z-ai/glm-5.3-flash': 'GLM-5.3 Flash' };

type PetView = MindPet & {
  token_id: string; owner_id: string; model: string; messages: number; bond: number; hibernating: boolean;
  outfit?: string[];
};
type Turn = { role: 'user' | 'assistant'; content: string };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const provider = new JsonRpcProvider({ url: RPC_URL });
const verifiable = new Set<string>();
let owner: Account | null = null;
let pet: PetView | null = null;
let diaryKey: CryptoKey | null = null;
let diary: DiaryEntry = emptyDiary();
let ai: InferenceClient | null = null;
let aiKeyUsed = '';
const turns: Turn[] = [];

const style = document.createElement('style');
style.textContent = MOCHI_CSS;
document.head.append(style);
drawPet('baby', 'hibernating', 'none');
checkReach();
// The Ownling light stays live: switch the app's server off or on and it shows within seconds.
setInterval(() => reachable(`${APP_URL}/health`).then((ok) => chip('chip-app', 'Ownling app', ok)), 15_000);

$('signin').addEventListener('submit', (e) => {
  e.preventDefault();
  signIn().catch((err) => show('signin-error', err));
});
$('composer').addEventListener('submit', (e) => {
  e.preventDefault();
  send().catch((err) => show('talk-error', err));
});

function checkReach() {
  reachable(`${APP_URL}/health`).then((ok) => chip('chip-app', 'Ownling app', ok));
  provider.viewAccount({ accountId: CONTRACT }).then(() => true, () => false).then((ok) => chip('chip-contract', 'Pet contract', ok));
  fetch(`${NEAR_AI}/model/list`, { signal: AbortSignal.timeout(10000) })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((models) => {
      for (const m of models?.models ?? []) if (m.metadata?.verifiable && m.metadata?.attestationSupported) verifiable.add(m.modelId);
      chip('chip-ai', 'NEAR AI', models !== null);
    });
}

async function reachable(url: string): Promise<boolean> {
  try {
    // A first connection can take several seconds on a slow network; that isn't "unreachable".
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    return res.ok;
  } catch {
    return false;
  }
}

function chip(id: string, name: string, ok: boolean) {
  const el = $(id);
  el.dataset.state = ok ? 'ok' : 'off';
  el.lastElementChild!.textContent = `${name} · ${ok ? 'reachable' : 'unreachable'}`;
}

async function signIn() {
  hide('signin-error');
  const phrase = $<HTMLTextAreaElement>('phrase').value.trim().toLowerCase().split(/\s+/).join(' ');
  if (phrase.split(' ').length !== 12) throw new Error('A recovery phrase has 12 words');
  let keyPair;
  try { keyPair = parseSeedPhrase(phrase); } catch { throw new Error("That phrase isn't valid; check each word"); }
  busy('signin-button', true, 'Signing in');
  try {
    const lookup = await fetch(`${KEY_LOOKUP}/${keyPair.getPublicKey().toString()}`).then((r) => r.json()).catch(() => null);
    const accountId: string | undefined = lookup?.account_ids?.[0];
    if (!accountId) throw new Error('No NEAR account uses this phrase');
    owner = new Account(accountId, provider, keyPair.toString() as `ed25519:${string}`);

    const pets = (await provider.callFunction({ contractId: CONTRACT, method: 'pets_for_owner', args: { account_id: accountId, limit: 1 } })) as PetView[];
    pet = pets[0] ?? null;
    if (!pet) throw new Error(`${accountId} has no pet on ${CONTRACT}`);

    const signed = await signMessage({ signerAccount: owner, payload: diaryKeyMessage(CONTRACT, pet.token_id) });
    diaryKey = await deriveDiaryKey(signed.signature, CONTRACT, pet.token_id);
    const stored = (await provider.callFunction({ contractId: CONTRACT, method: 'get_diary', args: { token_id: pet.token_id } })) as { ciphertext: string } | null;
    diary = stored ? await openDiary(diaryKey, stored.ciphertext) : emptyDiary();

    showFacts(accountId, stored ? Math.floor((stored.ciphertext.length * 3) / 4) : 0);
    // The phrase has done its job: clear it so it can't be seen on screen or in a recording.
    $<HTMLTextAreaElement>('phrase').value = '';
    $('signin').hidden = true;
    $('signin-note').textContent = `Signed in as ${accountId}. Diary key rebuilt in this tab.`;
    $<HTMLInputElement>('message').disabled = false;
    $<HTMLButtonElement>('send').disabled = false;
    const growth = pet.messages + pet.bond;
    drawPet(stageFor(growth), moodOf(pet), 'waking');
    setTimeout(() => pet && drawPet(stageFor(pet.messages + pet.bond), moodOf(pet), 'none'), 3000);
  } finally {
    busy('signin-button', false, 'Sign in');
  }
}

function showFacts(accountId: string, diaryBytes: number) {
  if (!pet) return;
  const growth = pet.messages + pet.bond;
  const food = Number(BigInt(pet.budget) / 10n ** 18n) / 1e6;
  $('f-contract').textContent = CONTRACT;
  $('f-token').textContent = `#${pet.token_id} · ${pet.name}`;
  $('f-owner').textContent = accountId;
  $('f-growth').textContent = `${growth} · ${stageFor(growth)}`;
  $('f-food').textContent = `${food.toFixed(2)} testnet NEAR`;
  $('f-diary').textContent = diaryBytes ? `${(diaryBytes / 1024).toFixed(1)} KB · unlocked` : 'empty · unlocked';
  $('f-model').textContent = MODEL_NAMES[pet.model] ?? pet.model;
}

async function send() {
  hide('talk-error');
  if (!pet || !owner) throw new Error('Sign in first');
  const message = $<HTMLInputElement>('message').value.trim();
  if (!message) return;
  const apiKey = $<HTMLInputElement>('ai-key').value.trim();
  if (!apiKey) throw new Error('Add your NEAR AI key in step 1; it pays for replies on this page');
  if (moodOf(pet) === 'hibernating') throw new Error(`${pet.name} is hibernating. Feed it in any Ownling client to wake it.`);
  if (!ai || aiKeyUsed !== apiKey) {
    ai = new InferenceClient({ baseUrl: NEAR_AI, apiKey, e2ee: true });
    aiKeyUsed = apiKey;
  }

  $<HTMLInputElement>('message').value = '';
  bubble('user', message);
  const pending = proofLine('pending', 'Pending', 'waiting for NEAR AI');
  const stage = stageFor(pet.messages + pet.bond);
  drawPet(stage, moodOf(pet), 'thinking');
  busy('send', true, 'Send');
  try {
    const model = verifiable.has(pet.model) ? pet.model : DEFAULT_MODEL;
    const completion = await ai.chat.completions.create({
      model,
      max_tokens: MAX_REPLY_TOKENS,
      // GLM-5.3 Flash reasons by default; "low" keeps it to a few tokens, which a pet's chat doesn't need.
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: systemPrompt(pet, memoryText(diary)) },
        ...turns.slice(-MAX_HISTORY),
        { role: 'user', content: message },
      ],
    });
    const { reply, remember: learned } = parseThought(completion.choices[0]?.message.content?.trim() ?? '');
    pending.remove();
    bubble('assistant', reply);
    turns.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    try {
      await ai.verifyResponse(completion.id);
      proofLine('verified', 'Verified', 'signed by NEAR AI hardware · no Ownling kitchen used');
      drawPet(stage, moodOf(pet), 'verified');
    } catch {
      proofLine('none', 'No proof', 'the reply arrived but its signature could not be checked');
      drawPet(stage, moodOf(pet), 'talking');
    }
    setTimeout(() => pet && drawPet(stage, moodOf(pet), 'none'), 2000);
    keepInDiary(message, reply, learned).catch(() => {});
  } catch (err) {
    pending.remove();
    drawPet(stage, moodOf(pet), 'none');
    throw err;
  } finally {
    busy('send', false, 'Send');
  }
}

/** Mochi keeps remembering here too: the owner's own key writes the diary, no kitchen needed. */
async function keepInDiary(said: string, replied: string, facts: string[]) {
  if (!owner || !pet || !diaryKey) return;
  diary = remember(diary, [{ role: 'user', content: said }, { role: 'assistant', content: replied }], facts);
  const sealed = await sealDiary(diaryKey, diary);
  await owner.callFunction({
    contractId: CONTRACT,
    methodName: 'save_diary',
    args: { token_id: pet.token_id, ciphertext: sealed.ciphertext, hash: sealed.hash },
    gas: GAS,
  });
}

function moodOf(p: PetView) {
  return moodFor(Number(BigInt(p.budget) / 10n ** 18n) / 1e6, Number(BigInt(p.daily_cap) / 10n ** 18n) / 1e6);
}

function drawPet(stage: ReturnType<typeof stageFor>, mood: ReturnType<typeof moodFor>, moment: Moment) {
  $('pet').innerHTML = renderMochi({ stage, mood, moment, size: 300, name: pet?.name ?? 'Mochi', dress: outfitSvg(stage, pet?.outfit ?? []) });
}

function bubble(role: 'user' | 'assistant', text: string) {
  const li = document.createElement('li');
  li.className = `bubble ${role === 'user' ? 'you' : 'pet-says'}`;
  // *actions* in italics, everything else as plain text.
  for (const part of text.split(/(\*[^*]+\*)/)) {
    if (!part) continue;
    const node = part.startsWith('*') && part.endsWith('*') ? document.createElement('em') : document.createElement('span');
    node.textContent = part;
    li.append(node);
  }
  $('bubbles').append(li);
}

function proofLine(kind: 'verified' | 'pending' | 'none', label: string, detail: string): HTMLElement {
  const li = document.createElement('li');
  li.className = 'proof-line';
  const tag = document.createElement('span');
  tag.className = `tag ${kind}`;
  tag.textContent = label;
  const note = document.createElement('span');
  note.className = 'mono muted';
  note.textContent = detail;
  li.append(tag, note);
  $('bubbles').append(li);
  return li;
}

function busy(id: string, on: boolean, label: string) {
  const b = $<HTMLButtonElement>(id);
  b.disabled = on;
  b.textContent = label;
}

function show(id: string, err: unknown) {
  const el = $(id);
  el.textContent = err instanceof Error ? err.message : String(err);
  el.hidden = false;
}

function hide(id: string) {
  $(id).hidden = true;
}
