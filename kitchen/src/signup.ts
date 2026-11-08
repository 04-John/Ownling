// New players: a named testnet account (cloud-1234.ownling.testnet) whose only key is the one the
// player's browser made, funded with starter test NEAR by the sponsor. The kitchen never sees the
// private key and keeps no access to the account afterwards.
import { randomInt } from 'node:crypto';
import { Account } from 'near-api-js';
import { provider } from './chain.ts';
import { config } from './config.ts';

const PUBLIC_KEY = /^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const HOUR_MS = 60 * 60 * 1000;
const MAX_PER_ADDRESS_PER_HOUR = 3;
const MAX_PER_DAY = 60;

const sponsor = config.sponsorPrivateKey
  ? new Account(config.sponsorAccountId, provider, config.sponsorPrivateKey as `ed25519:${string}`)
  : null;
const recent: { at: number; address: string }[] = [];

export class SignupError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const signupOpen = () => sponsor !== null;

export async function createPlayer(publicKey: unknown, address: string): Promise<{ accountId: string }> {
  if (!sponsor) throw new SignupError(503, 'New accounts are closed on this kitchen');
  if (typeof publicKey !== 'string' || !PUBLIC_KEY.test(publicKey)) {
    throw new SignupError(400, 'publicKey must be an ed25519 public key');
  }
  const now = Date.now();
  while (recent.length && recent[0].at < now - 24 * HOUR_MS) recent.shift();
  if (recent.length >= MAX_PER_DAY) throw new SignupError(429, 'Too many new accounts today; try tomorrow');
  if (recent.filter((r) => r.address === address && r.at > now - HOUR_MS).length >= MAX_PER_ADDRESS_PER_HOUR) {
    throw new SignupError(429, 'Too many new accounts from this network; try again in an hour');
  }

  const starter = BigInt(Math.round(Number(config.playerStarterNear) * 1e6)) * 10n ** 18n;
  for (let attempt = 0; attempt < 6; attempt++) {
    const handle = `cloud-${randomInt(1000, 100000)}`;
    const accountId = `${handle}.${config.sponsorAccountId}`;
    if (await exists(accountId)) continue;
    await sponsor.createSubAccount({ accountOrPrefix: handle, publicKey, nearToTransfer: starter });
    recent.push({ at: now, address });
    console.log(`signup ${accountId}`);
    return { accountId };
  }
  throw new SignupError(503, 'Could not find a free account name; try again');
}

async function exists(accountId: string): Promise<boolean> {
  try {
    await provider.viewAccount({ accountId });
    return true;
  } catch {
    return false;
  }
}
