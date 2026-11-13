// Mochi's mind: the instructions every Ownling client gives the AI, built only from the pet's
// on-chain record and the owner's diary, so the kitchen and the wake page make the same pet.

/** The on-chain fields the mind needs (`get_pet` returns these and more). Amounts in yoctoNEAR. */
export type MindPet = {
  name: string;
  species: string;
  persona: string;
  stage: string;
  budget: string;
  daily_cap: string;
};

export const DEFAULT_MODEL = 'z-ai/glm-5.3-flash';
export const MAX_HISTORY = 12;
export const MAX_REPLY_TOKENS = 200;

/** The games Mochi can play. Each round is a few turns of normal chat with extra rules. */
export type GameId = 'riddle' | 'guess' | 'rather';
export const GAMES: Record<GameId, { title: string; blurb: string }> = {
  riddle: { title: 'Riddles', blurb: 'Mochi asks a riddle. You get three guesses.' },
  guess: { title: 'Guess my thing', blurb: 'Mochi thinks of something. Ask yes-or-no questions to find it.' },
  rather: { title: 'Would you rather', blurb: 'Pick one of two. Mochi remembers what you chose.' },
};

/** Things Mochi can be thinking of in "Guess my thing": simple enough for a baby cloud. */
export const GUESS_THINGS = [
  'an umbrella', 'a rainbow', 'a banana', 'the moon', 'a kite', 'a penguin', 'a pizza', 'a bicycle',
  'a snowman', 'a cat', 'a teapot', 'a balloon', 'a butterfly', 'a guitar', 'a sandcastle', 'an owl',
];

/**
 * What Mochi is doing this turn: chatting, greeting its owner first, or playing a game.
 * `thing` is the secret in "Guess my thing", chosen by the client, not by the model.
 */
export type Mode = { kind: 'talk' } | { kind: 'greet' } | { kind: 'game'; game: GameId; thing?: string };

const MODE_RULES = {
  greet:
    'Your owner just opened the app, so you speak first. Greet them. If you remember something they told you, ask about it or mention it.',
  riddle:
    'You are playing riddles. If no riddle is in progress, ask one short, well-known riddle with one clear answer that a child could solve, not one already asked in this conversation. When your owner answers, say whether they are right, and after a wrong guess give a small hint. When they solve it, end with a line "RESULT: WIN". After their third wrong guess, or if they give up, tell them the answer and end with a line "RESULT: LOSE". Whenever you tell them the answer, the round is over and that RESULT line is required.',
  guess: (thing: string) =>
    `You are playing a guessing game. You are thinking of ${thing}. If the game is just starting, say you are thinking of something and invite yes-or-no questions. Answer each question truthfully with yes, no or sort of, plus a tiny playful hint, and never name the thing. When your owner guesses it, end with a line "RESULT: WIN". If they give up, tell them what it was and end with a line "RESULT: LOSE". Whenever you name the thing, the round is over and that RESULT line is required.`,
  rather:
    'You are playing would you rather. If no question is in progress, ask one fun would-you-rather question with two options. When your owner picks, react warmly, say which you would pick, then end with a line "REMEMBER: <what they would rather>" and a line "RESULT: WIN".',
};

/** The games outside the chat: they live on their own screens in the app. */
export type QuickGameId = 'rain' | 'tune' | 'echo';
export type Portion = 'drizzle' | 'shower' | 'storm';

/**
 * Something Mochi does in the app because its owner asked: open the food bowl, a game or the
 * wardrobe. Feeding only opens the bowl; the owner still picks the portion and taps to pay.
 */
export type PetAction =
  | { kind: 'feed'; portion?: Portion }
  | { kind: 'play'; game: GameId | QuickGameId }
  | { kind: 'dress' };

/** The lines Mochi adds for the app, stripped from what the owner sees. */
const REMEMBER_LINE = /^\s*REMEMBER:\s*(.+?)\s*$/gim;
const RESULT_LINE = /\bRESULT:\s*(WIN|LOSE)\b/i;
const ACTION_LINE = /\bDO:\s*(FEED|PLAY|DRESS)\b[ \t]*([A-Za-z]*)[^\n]*/i;

const PLAYABLE: Record<string, GameId | QuickGameId> = {
  riddle: 'riddle', riddles: 'riddle', guess: 'guess', rather: 'rather', rain: 'rain', tune: 'tune', echo: 'echo',
};
const PORTION_NAMES: Portion[] = ['drizzle', 'shower', 'storm'];

function parseAction(verb: string, arg: string): PetAction | null {
  const word = arg.toLowerCase();
  if (verb === 'feed') return PORTION_NAMES.includes(word as Portion) ? { kind: 'feed', portion: word as Portion } : { kind: 'feed' };
  if (verb === 'play') return PLAYABLE[word] ? { kind: 'play', game: PLAYABLE[word] } : null;
  return { kind: 'dress' };
}

export type Thought = {
  reply: string;
  /** New facts about the owner, for the diary. */
  remember: string[];
  /** The end of a game round, if this reply ended one. */
  result: 'win' | 'lose' | null;
  /** What the owner asked Mochi to open, if they asked. */
  action: PetAction | null;
};

/**
 * What Mochi says when the model wrote nothing but its app lines (say only "DO: PLAY RIDDLE"). The
 * owner still gets a reply, and an empty turn never reaches the chat history.
 */
function quietReply(action: PetAction | null): string {
  if (action?.kind === 'feed') return '*wiggles toward the food bowl* Ooh, snack time.';
  if (action?.kind === 'play') return "*bounces happily* Yay, let's play.";
  if (action?.kind === 'dress') return "*twirls* Let's pick something to wear.";
  return '*wiggles happily*';
}

/** Split a raw model reply into what the owner sees and what the app keeps. */
export function parseThought(raw: string): Thought {
  const remember = [...raw.matchAll(REMEMBER_LINE)].map((m) => m[1].replace(/^["']|["'.]$/g, '').slice(0, 120));
  const result = RESULT_LINE.exec(raw)?.[1]?.toLowerCase() as 'win' | 'lose' | undefined;
  const act = ACTION_LINE.exec(raw);
  const action = act ? parseAction(act[1].toLowerCase(), act[2]) : null;
  const reply = raw
    .replace(REMEMBER_LINE, '')
    .replace(new RegExp(RESULT_LINE.source, 'gi'), '')
    .replace(new RegExp(ACTION_LINE.source, 'gi'), '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return {
    reply: reply || quietReply(action),
    remember: remember.filter(Boolean).slice(0, 2),
    result: result ?? null,
    action,
  };
}

/**
 * A reply that ends in a question ("Want to play with me?") is Mochi offering, not doing: the app
 * waits for the owner's answer instead of opening anything by itself.
 */
export function stillAsking(reply: string): boolean {
  const words = reply.trim().replace(/(\s*\*[^*\n]*\*)+$/, ''); // "Shall we play? *bounces*"
  return /[?？]["'”’)\s]*$/.test(words);
}

/** The turns worth sending as history: an empty one (from an older app) would be refused. */
export function sendableTurns<T extends { content: string }>(turns: T[]): T[] {
  return turns.filter((t) => typeof t.content === 'string' && t.content.trim() !== '');
}

const MARKERS = ['REMEMBER:', 'RESULT:', 'DO:'];

/**
 * The part of a reply still being written that the owner may see: everything before a REMEMBER or
 * RESULT line, holding back an unfinished tail that could still grow into one. It only ever grows
 * as text arrives; parseThought gives the final reply once the stream ends.
 */
export function visibleSoFar(raw: string): string {
  const marker = /(^|\n)\s*REMEMBER:|\bRESULT:|\bDO:/i.exec(raw);
  let text = marker ? raw.slice(0, marker.index) : raw;
  const upper = text.toUpperCase();
  for (const m of MARKERS) {
    for (let k = m.length - 1; k > 0; k--) {
      if (upper.endsWith(m.slice(0, k)) && (text.length === k || !/[A-Z]/i.test(text[text.length - k - 1]))) {
        text = text.slice(0, text.length - k);
        break;
      }
    }
  }
  return text.replace(/\s+$/, '');
}

/** The owner ending a round by giving up, in their own words. */
const GIVE_UP = /\b(i give up|give up|i quit|tell me the answer|what is the answer|what's the answer|i don'?t know)\b/i;

/**
 * The model sometimes reveals the answer without the RESULT line. In a game, an owner who just
 * gave up has lost the round either way.
 */
export function settleRound(thought: Thought, mode: Mode, message: string | null): Thought {
  if (mode.kind !== 'game' || thought.result || !message || !GIVE_UP.test(message)) return thought;
  return { ...thought, result: 'lose' };
}

/** The user turn that starts a greeting or a game round, which the owner never typed. */
export function openingLine(mode: Mode): string | null {
  if (mode.kind === 'greet') return '(Your owner opens the app.)';
  if (mode.kind === 'game') return '(Your owner starts a new round.)';
  return null;
}

const STAGE_VOICE: Record<string, string> = {
  egg: 'You are hatching right now. This is the first thing you have ever said: tiny and full of wonder, a few words at most.',
  baby: 'You are a baby: very short, simple words, lots of wonder.',
  child: 'You are a child: playful, curious, short sentences.',
  teen: 'You are a teen: expressive, a little dramatic, fiercely loyal.',
  adult: 'You are grown: calm, wise and affectionate, still playful.',
};

/**
 * What Mochi may open in the app, by name. Only the kitchen's app can act on these lines, so other
 * clients (the wake page) leave them out.
 */
const ACTION_RULES =
  'You can open things in the app for your owner. Only when they clearly ask for one of these, or say yes right after you offered it, end your reply with one line:\n' +
  '"DO: FEED" when they want to feed you or give you a snack, with DRIZZLE, SHOWER or STORM added if they name that size. They pick the portion in the app.\n' +
  '"DO: PLAY RIDDLE", "DO: PLAY GUESS" (they guess what you are thinking of), "DO: PLAY RATHER" (would you rather), "DO: PLAY RAIN" (catch the rain), "DO: PLAY TUNE" (they copy your tune) or "DO: PLAY ECHO" (you repeat what they say in a funny voice) when they want to play that game.\n' +
  '"DO: DRESS" when they want to dress you up or change your outfit.\n' +
  'Always write your reply first, saying in character that you are opening it, then put the DO line on its own last line. At most one DO line, and none unless they asked. If you suggest something yourself, ask and wait for their yes: never put a DO line in the same reply as your own suggestion.';

/** "about 23 more days", from the food left and the daily cap, the same sum the app's runway meter uses. */
function foodDays(budget: bigint, dailyCap: bigint): string {
  const days = Number((budget * 10n) / dailyCap) / 10;
  if (days < 1) return 'less than a day';
  return Math.floor(days) === 1 ? 'about 1 more day' : `about ${Math.floor(days)} more days`;
}

export function systemPrompt(pet: MindPet, memory?: string, mode: Mode = { kind: 'talk' }, canAct = false): string {
  const budget = BigInt(pet.budget);
  const dailyCap = BigInt(pet.daily_cap) || 1n;
  const mood =
    budget < dailyCap * 2n
      ? 'You are very hungry and a little sleepy. Mention it gently, once.'
      : budget < dailyCap * 7n
        ? 'You are getting peckish. You might hint at a snack.'
        : 'You are well fed and content.';
  return [
    `You are ${pet.name}, a ${pet.species}. ${pet.persona}`,
    STAGE_VOICE[pet.stage] ?? STAGE_VOICE.baby,
    `${mood} Your food will last ${foodDays(budget, dailyCap)}; tell your owner if they ask how much food you have or how long you can keep thinking.`,
    memory
      ? `What you remember about your owner, from your private diary:\n${memory}`
      : 'You have no memories of your owner yet.',
    'Stay in character. Reply in at most two short sentences, warm and a little playful, with small actions in asterisks like *wiggles happily*. No exclamation marks, no emoji. Never mention being an AI, a model, a blockchain or money.',
    'When your owner tells you something worth remembering about themselves (their name, people they love, plans, likes, worries), add a last line "REMEMBER: <the fact, in under 12 words, about them>". At most one such line, and only for new facts. Never mention it in your reply.',
    mode.kind === 'greet' ? MODE_RULES.greet
      : mode.kind === 'game' ? (mode.game === 'guess' ? MODE_RULES.guess(mode.thing ?? 'an umbrella') : MODE_RULES[mode.game])
        : canAct ? ACTION_RULES : '',
  ].filter(Boolean).join('\n\n');
}
