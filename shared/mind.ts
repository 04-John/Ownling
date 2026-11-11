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

/** The lines Mochi adds for the app, stripped from what the owner sees. */
const REMEMBER_LINE = /^\s*REMEMBER:\s*(.+?)\s*$/gim;
const RESULT_LINE = /\bRESULT:\s*(WIN|LOSE)\b/i;

export type Thought = {
  reply: string;
  /** New facts about the owner, for the diary. */
  remember: string[];
  /** The end of a game round, if this reply ended one. */
  result: 'win' | 'lose' | null;
};

/** Split a raw model reply into what the owner sees and what the app keeps. */
export function parseThought(raw: string): Thought {
  const remember = [...raw.matchAll(REMEMBER_LINE)].map((m) => m[1].replace(/^["']|["'.]$/g, '').slice(0, 120));
  const result = RESULT_LINE.exec(raw)?.[1]?.toLowerCase() as 'win' | 'lose' | undefined;
  const reply = raw
    .replace(REMEMBER_LINE, '')
    .replace(new RegExp(RESULT_LINE.source, 'gi'), '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return { reply, remember: remember.filter(Boolean).slice(0, 2), result: result ?? null };
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

export function systemPrompt(pet: MindPet, memory?: string, mode: Mode = { kind: 'talk' }): string {
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
    mood,
    memory
      ? `What you remember about your owner, from your private diary:\n${memory}`
      : 'You have no memories of your owner yet.',
    'Stay in character. Reply in at most two short sentences, warm and a little playful, with small actions in asterisks like *wiggles happily*. No exclamation marks, no emoji. Never mention being an AI, a model, a blockchain or money.',
    'When your owner tells you something worth remembering about themselves (their name, people they love, plans, likes, worries), add a last line "REMEMBER: <the fact, in under 12 words, about them>". At most one such line, and only for new facts. Never mention it in your reply.',
    mode.kind === 'greet' ? MODE_RULES.greet
      : mode.kind === 'game' ? (mode.game === 'guess' ? MODE_RULES.guess(mode.thing ?? 'an umbrella') : MODE_RULES[mode.game])
        : '',
  ].filter(Boolean).join('\n\n');
}
