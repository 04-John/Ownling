// The kitchen's HTTP API.
//   GET  /health
//   POST /session  {accountId, publicKey, signature, nonce, issuedAt} -> {token, expiresAt}
//   POST /talk     Authorization: Bearer <token>; {tokenId, message, history?, memory?}
//                  -> {reply, model, usage, charged, budget, proof}
// The kitchen never logs what owners or pets say.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { AuthError, sessionAccount, startSession, type SignIn } from './auth.ts';
import { PRACTICE_MODE, think, type Turn } from './brain.ts';
import { charge, getPet } from './chain.ts';
import { config } from './config.ts';
import { costUsd, modelFor, usdToYocto } from './pricing.ts';

const PORT = Number(process.env.PORT ?? 8787);
const APP_ORIGIN = process.env.APP_ORIGIN ?? '*';
const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGE = 500;
const MAX_MEMORY = 4_000;
const MAX_TURN = 1_000;
const MAX_TURNS = 12;
/** A generous upper bound on one thought, so we never think for a pet that can't pay. */
const WORST_CASE_USAGE = { prompt_tokens: 6_000, completion_tokens: 400 };
/** What a practice-mode reply costs the pet: 0.000001 NEAR, so the on-chain flow still runs. */
const PRACTICE_CHARGE = 10n ** 18n;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Pets currently thinking, so one pet can't run two paid thoughts at once. */
const thinking = new Set<string>();

async function talk(req: IncomingMessage, body: unknown) {
  const accountId = sessionAccount(bearer(req));
  const { tokenId, message, history, memory } = parseTalk(body);

  const pet = await getPet(tokenId);
  if (!pet) throw new HttpError(404, 'No such pet');
  if (pet.owner_id !== accountId) throw new HttpError(403, 'Only the owner can talk to this pet');
  if (pet.kitchen !== config.kitchenAccountId) {
    throw new HttpError(409, `This pet eats at another kitchen (${pet.kitchen})`);
  }
  if (pet.hibernating) throw new HttpError(402, `${pet.name} is hibernating. Feed it to wake it up.`);

  const worstCase = usdToYocto(await costUsd(await modelFor(pet.model), WORST_CASE_USAGE));
  if (BigInt(pet.remaining_today) < worstCase) {
    throw new HttpError(429, `${pet.name} has used today's food allowance. Raise the daily cap or come back tomorrow.`);
  }
  if (BigInt(pet.budget) < worstCase) throw new HttpError(402, `${pet.name} is too hungry to think. Feed it.`);

  if (thinking.has(tokenId)) throw new HttpError(409, `${pet.name} is still thinking`);
  thinking.add(tokenId);
  try {
    const thought = await think(pet, history, message, memory);
    const amount = thought.proof ? usdToYocto(await costUsd(thought.model, thought.usage)) : PRACTICE_CHARGE;
    const budget = await charge(tokenId, amount, thought.receipt);
    console.log(`talk pet=${tokenId} model=${thought.model} tokens=${thought.usage.prompt_tokens}+${thought.usage.completion_tokens} charged=${amount}`);
    return {
      reply: thought.reply,
      model: thought.model,
      usage: thought.usage,
      charged: amount.toString(),
      budget,
      verified: thought.proof !== null,
      proof: thought.proof,
    };
  } finally {
    thinking.delete(tokenId);
  }
}

function parseTalk(body: unknown): { tokenId: string; message: string; history: Turn[]; memory?: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const text = (v: unknown, max: number, name: string) => {
    if (typeof v !== 'string' || v.trim() === '' || v.length > max) {
      throw new HttpError(400, `${name} must be a non-empty string of at most ${max} characters`);
    }
    return v;
  };
  const history = Array.isArray(b.history) ? b.history.slice(-MAX_TURNS) : [];
  return {
    tokenId: text(b.tokenId, 32, 'tokenId'),
    message: text(b.message, MAX_MESSAGE, 'message'),
    history: history.map((t) => {
      const turn = (t ?? {}) as Record<string, unknown>;
      if (turn.role !== 'user' && turn.role !== 'assistant') throw new HttpError(400, 'history roles must be user or assistant');
      return { role: turn.role, content: text(turn.content, MAX_TURN, 'history content') };
    }),
    memory: b.memory === undefined ? undefined : text(b.memory, MAX_MEMORY, 'memory'),
  };
}

function bearer(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request too large');
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'Body must be JSON');
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': APP_ORIGIN,
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.method === 'GET' && req.url === '/health') {
      return send(res, 200, {
        ok: true,
        kitchen: config.kitchenAccountId,
        contract: config.petsContract,
        practiceMode: PRACTICE_MODE,
      });
    }
    if (req.method === 'POST' && req.url === '/session') {
      return send(res, 200, await startSession((await readJson(req)) as SignIn));
    }
    if (req.method === 'POST' && req.url === '/talk') {
      return send(res, 200, await talk(req, await readJson(req)));
    }
    send(res, 404, { error: 'Not found' });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    if (err instanceof AuthError) return send(res, 401, { error: err.message });
    console.error(err);
    send(res, 500, { error: (err as Error).message ?? 'Kitchen error' });
  }
});

server.listen(PORT, () => {
  console.log(`Ownling kitchen ${config.kitchenAccountId} on http://localhost:${PORT} (contract ${config.petsContract})`);
});
