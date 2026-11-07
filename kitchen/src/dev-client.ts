// Development client: signs in to a running kitchen with a local NEAR credentials file, then
// optionally talks to a pet. Stands in for the app's wallet login.
// Usage: node src/dev-client.ts <credentials.json> [<token_id> "<message>"]
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { Account, JsonRpcProvider } from 'near-api-js';
import { signMessage } from 'near-api-js/nep413';

const KITCHEN_URL = process.env.KITCHEN_URL ?? 'http://localhost:8787';
const RPC_URL = process.env.NEAR_RPC_URL ?? 'https://test.rpc.fastnear.com';

const [credsPath, tokenId, ...words] = process.argv.slice(2);
if (!credsPath) {
  console.error('Usage: node src/dev-client.ts <credentials.json> [<token_id> "<message>"]');
  process.exit(1);
}
const creds = JSON.parse(readFileSync(credsPath, 'utf8')) as { account_id?: string; private_key: string };
// near-cli-rs keychain files are named <account>.json and don't repeat the account inside.
creds.account_id ??= basename(credsPath, '.json');
const account = new Account(
  creds.account_id,
  new JsonRpcProvider({ url: RPC_URL }),
  creds.private_key as `ed25519:${string}`,
);

const issuedAt = new Date().toISOString();
const nonce = new Uint8Array(randomBytes(32));
const signed = await signMessage({
  signerAccount: account,
  payload: {
    message: `Sign in to Ownling\nAccount: ${creds.account_id}\nIssued: ${issuedAt}`,
    recipient: 'ownling-kitchen',
    nonce,
  },
});

const session = await post('/session', {
  accountId: creds.account_id,
  publicKey: signed.publicKey.toString(),
  signature: Buffer.from(signed.signature).toString('base64'),
  nonce: Buffer.from(nonce).toString('base64'),
  issuedAt,
});
console.log(`signed in as ${creds.account_id}; session expires ${new Date(session.expiresAt).toISOString()}`);

if (tokenId && words.length) {
  console.log(JSON.stringify(await post('/talk', { tokenId, message: words.join(' ') }, session.token), null, 2));
}

async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(`${KITCHEN_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${json.error}`);
  return json;
}
