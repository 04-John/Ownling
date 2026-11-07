// The private diary: what an ownling remembers about its owner, encrypted so only that owner can
// read it. The key comes from the owner's NEAR account itself (a deterministic ed25519 signature
// over a fixed NEP-413 message), so any app or tool the owner signs in to can rebuild it, and no
// server ever needs to hold it. Works in browsers and Node (WebCrypto).

export const DIARY_VERSION = 1;
export const DIARY_RECIPIENT = 'ownling-diary';

export type DiaryTurn = { role: 'user' | 'assistant'; content: string };
export type DiaryEntry = {
  v: number;
  /** Short facts the pet has learned about its owner. */
  facts: string[];
  /** The most recent conversation, oldest first. */
  recent: DiaryTurn[];
  updatedAt: string;
};

const MAX_RECENT = 20;
const MAX_FACTS = 30;

/**
 * The NEP-413 message the owner signs to unlock a pet's diary. It is fixed (no timestamp, zero
 * nonce) so the signature, and therefore the key, is the same every time. Never send this
 * signature to a server: whoever holds it can read the diary.
 */
export function diaryKeyMessage(contractId: string, tokenId: string) {
  return {
    message: `Unlock the Ownling diary\nContract: ${contractId}\nPet: ${tokenId}\nOnly sign this in apps you trust with your pet's memories.`,
    recipient: DIARY_RECIPIENT,
    nonce: new Uint8Array(32),
  };
}

/** AES-256-GCM key from the owner's signature over `diaryKeyMessage`. */
export async function deriveDiaryKey(signature: Uint8Array, contractId: string, tokenId: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', toBuffer(signature), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('ownling-diary-v1'),
      info: new TextEncoder().encode(`${contractId}:${tokenId}`),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt a diary entry. Returns base64(iv || ciphertext) and the sha256 of it, as stored on-chain. */
export async function sealDiary(key: CryptoKey, entry: DiaryEntry): Promise<{ ciphertext: string; hash: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(entry));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  const blob = new Uint8Array(iv.length + sealed.length);
  blob.set(iv);
  blob.set(sealed, iv.length);
  return { ciphertext: toBase64(blob), hash: await sha256Hex(blob) };
}

/** Decrypt a diary entry. Throws if the key is wrong or the ciphertext was tampered with. */
export async function openDiary(key: CryptoKey, ciphertext: string): Promise<DiaryEntry> {
  const blob = fromBase64(ciphertext);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: blob.slice(0, 12) }, key, blob.slice(12));
  return JSON.parse(new TextDecoder().decode(plain)) as DiaryEntry;
}

export function emptyDiary(): DiaryEntry {
  return { v: DIARY_VERSION, facts: [], recent: [], updatedAt: new Date().toISOString() };
}

/** Add a conversation exchange (and any new facts), keeping the diary small. */
export function remember(entry: DiaryEntry, turns: DiaryTurn[], facts: string[] = []): DiaryEntry {
  const known = new Set(entry.facts);
  return {
    v: DIARY_VERSION,
    facts: [...entry.facts, ...facts.filter((f) => f && !known.has(f))].slice(-MAX_FACTS),
    recent: [...entry.recent, ...turns].slice(-MAX_RECENT),
    updatedAt: new Date().toISOString(),
  };
}

/** The diary as the short memory text the kitchen passes to the pet's mind. */
export function memoryText(entry: DiaryEntry): string | undefined {
  const lines = [
    ...entry.facts.map((f) => `- ${f}`),
    ...entry.recent.slice(-6).map((t) => `${t.role === 'user' ? 'Owner' : 'You'} said: ${t.content}`),
  ];
  return lines.length ? lines.join('\n').slice(0, 4_000) : undefined;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', toBuffer(bytes)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
