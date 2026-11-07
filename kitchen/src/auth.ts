// Owner sessions. At login the owner signs one NEP-413 message with a full-access key; the kitchen
// checks that key on-chain and returns a short-lived token, so chatting needs no wallet pop-ups.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { verifyMessage } from 'near-api-js/nep413';
import { provider } from './chain.ts';

export const SIGN_IN_RECIPIENT = 'ownling-kitchen';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SIGN_IN_MAX_AGE_MS = 5 * 60 * 1000;

const secret = process.env.KITCHEN_SESSION_SECRET
  ? Buffer.from(process.env.KITCHEN_SESSION_SECRET, 'utf8')
  : randomBytes(32);
/** Nonces of recent sign-ins (hex -> forget-after time), so a signature can't be replayed. */
const usedNonces = new Map<string, number>();

export class AuthError extends Error {}

/** The exact text the owner's wallet signs. */
export function signInMessage(accountId: string, issuedAt: string): string {
  return `Sign in to Ownling\nAccount: ${accountId}\nIssued: ${issuedAt}`;
}

export type SignIn = {
  accountId: string;
  publicKey: string;
  /** base64 */
  signature: string;
  /** base64, 32 bytes */
  nonce: string;
  /** ISO time that appears in the signed message */
  issuedAt: string;
};

export async function startSession(input: SignIn): Promise<{ token: string; expiresAt: number }> {
  const issued = Date.parse(input.issuedAt);
  if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > SIGN_IN_MAX_AGE_MS) {
    throw new AuthError('Sign-in message is too old; sign again');
  }
  const nonce = new Uint8Array(Buffer.from(input.nonce, 'base64'));
  if (nonce.length !== 32) throw new AuthError('Nonce must be 32 bytes');
  const nonceKey = Buffer.from(nonce).toString('hex');
  const now = Date.now();
  for (const [key, forgetAt] of usedNonces) if (forgetAt < now) usedNonces.delete(key);
  if (usedNonces.has(nonceKey)) throw new AuthError('This sign-in was already used');

  try {
    await verifyMessage({
      signerAccountId: input.accountId,
      signerPublicKey: input.publicKey,
      payload: {
        message: signInMessage(input.accountId, input.issuedAt),
        recipient: SIGN_IN_RECIPIENT,
        nonce,
      },
      signature: new Uint8Array(Buffer.from(input.signature, 'base64')),
      provider,
    });
  } catch (err) {
    throw new AuthError(`Sign-in rejected: ${(err as Error).message}`);
  }
  usedNonces.set(nonceKey, now + 2 * SIGN_IN_MAX_AGE_MS);

  const expiresAt = now + SESSION_TTL_MS;
  const body = Buffer.from(JSON.stringify({ acc: input.accountId, exp: expiresAt })).toString('base64url');
  return { token: `${body}.${mac(body)}`, expiresAt };
}

/** The account a session token belongs to. Throws AuthError if it's missing, forged or expired. */
export function sessionAccount(token: string | undefined): string {
  if (!token) throw new AuthError('Sign in first');
  const [body, tag] = token.split('.');
  if (!body || !tag || !safeEqual(tag, mac(body))) throw new AuthError('Invalid session');
  const { acc, exp } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
    acc: string;
    exp: number;
  };
  if (Date.now() > exp) throw new AuthError('Session expired; sign in again');
  return acc;
}

function mac(body: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
