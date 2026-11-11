// The kitchen's HTTP API.
//   GET  /health
//   POST /signup   {publicKey} -> {accountId}   (a new player's named testnet account)
//   POST /session  {accountId, publicKey, signature, nonce, issuedAt} -> {token, expiresAt}
//   POST /talk     Authorization: Bearer <token>; {tokenId, message, history?, memory?, kind?, game?, thing?}
//                  kind: talk (default), greet (Mochi speaks first) or game (a round of riddle, guess
//                  or rather; no message opens the round)
//                  -> {reply, remember, result, model, usage, charged, budget, proof}
//   POST /listen?name=<pet>  Authorization: Bearer <token>; a voice clip (audio/webm, audio/mp4, ...)
//                  -> {text}: speech to text on NEAR AI's Whisper. The clip isn't kept or logged.
//   GET  anything else -> the built game app from STATIC_DIR, when set (one address for app and kitchen);
//        /download opens its Get the app screen
// The kitchen never logs what owners or pets say.
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { AuthError, sessionAccount, startSession, type SignIn } from './auth.ts';
import { GAMES, GUESS_THINGS, type GameId, type Mode } from '../../shared/mind.ts';
import { PRACTICE_MODE, think, transcribe, warmUp, type Turn } from './brain.ts';
import { charge, getPet } from './chain.ts';
import { config } from './config.ts';
import { costUsd, modelFor, usdToYocto } from './pricing.ts';
import { createPlayer, SignupError, signupOpen } from './signup.ts';

const PORT = Number(process.env.PORT ?? 8787);
const APP_ORIGIN = process.env.APP_ORIGIN ?? '*';
const STATIC_DIR = process.env.STATIC_DIR ? resolve(process.env.STATIC_DIR) : null;
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
const MAX_BODY_BYTES = 64 * 1024;
/** 30 seconds of 16 kHz mono WAV is under 1 MB. */
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
// Voice chat sends a short clip every few seconds while you speak, for the live transcript.
const MAX_CLIPS_PER_HOUR = 400;
const HOUR_MS = 60 * 60 * 1000;
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
  const { tokenId, message, history, memory, mode } = parseTalk(body);

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
    const thought = await think(pet, history, message, memory, mode);
    const amount = thought.proof ? usdToYocto(await costUsd(thought.model, thought.usage)) : PRACTICE_CHARGE;
    const budget = await charge(tokenId, amount, thought.receipt);
    console.log(`${mode.kind} pet=${tokenId} model=${thought.model} tokens=${thought.usage.prompt_tokens}+${thought.usage.completion_tokens} charged=${amount}`);
    return {
      reply: thought.reply,
      remember: thought.remember,
      result: thought.result,
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

function parseTalk(body: unknown): { tokenId: string; message: string | null; history: Turn[]; memory?: string; mode: Mode } {
  const b = (body ?? {}) as Record<string, unknown>;
  const text = (v: unknown, max: number, name: string) => {
    if (typeof v !== 'string' || v.trim() === '' || v.length > max) {
      throw new HttpError(400, `${name} must be a non-empty string of at most ${max} characters`);
    }
    return v;
  };
  const mode = parseMode(b);
  // Mochi speaks first when greeting or opening a game round; otherwise the owner said something.
  const speaksFirst = mode.kind === 'greet' || (mode.kind === 'game' && b.message == null);
  const history = Array.isArray(b.history) ? b.history.slice(-MAX_TURNS) : [];
  return {
    mode,
    tokenId: text(b.tokenId, 32, 'tokenId'),
    message: speaksFirst ? null : text(b.message, MAX_MESSAGE, 'message'),
    history: history.map((t) => {
      const turn = (t ?? {}) as Record<string, unknown>;
      if (turn.role !== 'user' && turn.role !== 'assistant') throw new HttpError(400, 'history roles must be user or assistant');
      return { role: turn.role, content: text(turn.content, MAX_TURN, 'history content') };
    }),
    memory: b.memory === undefined ? undefined : text(b.memory, MAX_MEMORY, 'memory'),
  };
}

/** `kind` is talk (default), greet or game. A game's secret thing must come from GUESS_THINGS, so no
 * client text ever reaches the system prompt. */
function parseMode(b: Record<string, unknown>): Mode {
  if (b.kind === undefined || b.kind === 'talk') return { kind: 'talk' };
  if (b.kind === 'greet') return { kind: 'greet' };
  if (b.kind !== 'game') throw new HttpError(400, 'kind must be talk, greet or game');
  if (typeof b.game !== 'string' || !(b.game in GAMES)) throw new HttpError(400, `game must be one of ${Object.keys(GAMES).join(', ')}`);
  const game = b.game as GameId;
  if (game !== 'guess') return { kind: 'game', game };
  if (typeof b.thing !== 'string' || !GUESS_THINGS.includes(b.thing)) throw new HttpError(400, 'thing must be one of the guessing game things');
  return { kind: 'game', game, thing: b.thing };
}

/** The caller's address, behind a hosting proxy when there is one. */
function clientAddress(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'unknown';
}

function bearer(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

async function readBody(req: IncomingMessage, max: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > max) throw new HttpError(413, 'Request too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const body = await readBody(req, MAX_BODY_BYTES);
  try {
    return JSON.parse(body.toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'Body must be JSON');
  }
}

/** Voice clips heard per account in the last hour, so one player can't run up the kitchen's bill. */
const heard = new Map<string, number[]>();

/** Speech to text for a signed-in owner. The clip is passed to NEAR AI and not kept or logged. */
async function listen(req: IncomingMessage) {
  const accountId = sessionAccount(bearer(req));
  const type = String(req.headers['content-type'] ?? '');
  if (!/^audio\//.test(type)) throw new HttpError(415, 'Send a voice clip');
  const now = Date.now();
  const recent = (heard.get(accountId) ?? []).filter((t) => now - t < HOUR_MS);
  if (recent.length >= MAX_CLIPS_PER_HOUR) throw new HttpError(429, 'That is a lot of talking. Try typing for a while.');
  heard.set(accountId, [...recent, now]);
  const audio = await readBody(req, MAX_AUDIO_BYTES);
  if (audio.length < 1_000) throw new HttpError(400, "That clip was too short to hear");
  // The pet's name, only as a spelling hint for the speech model.
  const name = new URL(req.url ?? '/', 'http://x').searchParams.get('name')?.replace(/[^\p{L}\p{N} '-]/gu, '').slice(0, 24);
  return { text: await transcribe(audio, type, name || undefined) };
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

/** Serves a file from the built app. The app routes with #hash, so unknown paths get index.html. */
async function sendStatic(req: IncomingMessage, res: ServerResponse, root: string) {
  let path: string;
  try {
    path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  } catch {
    throw new HttpError(400, 'Bad path');
  }
  let file = resolve(root, `.${path}`);
  if (file !== root && !file.startsWith(root + sep)) throw new HttpError(404, 'Not found');
  let data: Buffer;
  try {
    data = await readFile(file);
  } catch {
    file = resolve(root, 'index.html');
    data = await readFile(file);
  }
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    // Vite puts a content hash in every file name under assets/, so those never change.
    'cache-control': file.startsWith(resolve(root, 'assets') + sep) ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  res.end(req.method === 'HEAD' ? undefined : data);
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
        signupOpen: signupOpen(),
      });
    }
    if (req.method === 'POST' && req.url === '/signup') {
      const { publicKey } = (await readJson(req)) as { publicKey?: unknown };
      return send(res, 200, await createPlayer(publicKey, clientAddress(req)));
    }
    if (req.method === 'POST' && req.url === '/session') {
      return send(res, 200, await startSession((await readJson(req)) as SignIn));
    }
    if (req.method === 'POST' && req.url === '/talk') {
      return send(res, 200, await talk(req, await readJson(req)));
    }
    if (req.method === 'POST' && req.url?.startsWith('/listen')) {
      return send(res, 200, await listen(req));
    }
    if (STATIC_DIR && req.method === 'GET' && /^\/download\/?$/.test(req.url ?? '')) {
      res.writeHead(302, { location: '/#/download' });
      return res.end();
    }
    if (STATIC_DIR && (req.method === 'GET' || req.method === 'HEAD')) return await sendStatic(req, res, STATIC_DIR);
    send(res, 404, { error: 'Not found' });
  } catch (err) {
    if (err instanceof HttpError || err instanceof SignupError) return send(res, err.status, { error: err.message });
    if (err instanceof AuthError) return send(res, 401, { error: err.message });
    console.error(err);
    send(res, 500, { error: (err as Error).message ?? 'Kitchen error' });
  }
});

server.listen(PORT, () => {
  console.log(`Ownling kitchen ${config.kitchenAccountId} on http://localhost:${PORT} (contract ${config.petsContract})`);
  if (STATIC_DIR) console.log(`Serving the game app from ${STATIC_DIR}`);
  if (!PRACTICE_MODE) {
    warmUp()
      .then((ms) => console.log(`NEAR AI connection ready in ${ms} ms`))
      .catch((err) => console.error(`NEAR AI warm-up failed: ${(err as Error).message}`));
  }
});
