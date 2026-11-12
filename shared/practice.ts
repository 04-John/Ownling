// Practice mode's stand-in for the AI, used by the kitchen (KITCHEN_MOCK=1) and the app's mock
// client: fixed lines that follow the same rules as the real mind, including REMEMBER and RESULT
// lines and the three games, so every screen can be tried before NEAR AI credits are active.
// Replies are never presented as verified.
import type { DiaryTurn as Turn } from './diary.ts';
import type { Mode } from './mind.ts';

const CHAT = [
  '*floats closer* Hello. I was just watching the clouds.',
  'Ooh, tell me more. *wiggles happily*',
  'I like it when you visit. It feels like rain on a warm day.',
  '*yawns softly* I remember you. You are kind.',
];

const RIDDLES = [
  { q: "What has keys but can't open a single door?", a: ['piano', 'keyboard'] },
  { q: 'What gets wetter the more it dries?', a: ['towel'] },
  { q: 'What has a face and two hands but no arms or legs?', a: ['clock', 'watch'] },
  { q: 'What goes up when the rain comes down?', a: ['umbrella'] },
];

const RATHER: [string, string][] = [
  ['fly like a bird', 'swim like a fish'],
  ['live on a cloud', 'live under the sea'],
  ['have a pet dragon', 'have a pet unicorn'],
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const PRACTICE_GAMES: [RegExp, string, string][] = [
  [/\b(rain|catch)\b/, 'RAIN', 'Catch the rain'],
  [/\b(tune|song|sing)\b/, 'TUNE', 'my tune game'],
  [/\becho\b/, 'ECHO', 'Echo'],
  [/\briddles?\b/, 'RIDDLE', 'riddles'],
  [/\bguess\b/, 'GUESS', 'the guessing game'],
  [/\brather\b/, 'RATHER', 'would you rather'],
];

/** Requests the real mind answers with a DO line, so the mock can open the same screens. */
function practiceAction(said: string): string | null {
  if (/\b(feed|food|snack|eat)\b/.test(said)) {
    const size = /\b(drizzle|shower|storm)\b/.exec(said)?.[1];
    return `*bounces* Yes please. I'll open my bowl.\nDO: FEED${size ? ` ${size.toUpperCase()}` : ''}`;
  }
  if (/\b(dress|outfit|wear)\b/.test(said)) return "*twirls* Ooh, dress-up. Let's open the wardrobe.\nDO: DRESS";
  if (/\b(play|game)\b/.test(said)) {
    const game = PRACTICE_GAMES.find(([re]) => re.test(said));
    return game
      ? `*bounces* Yes, let's play ${game[2]}.\nDO: PLAY ${game[1]}`
      : '*wiggles* Ooh, what shall we play? Riddles, catch the rain, or my tune game?';
  }
  return null;
}

export function practiceReply(pet: { messages: number }, history: Turn[], message: string | null, mode: Mode): string {
  const said = (message ?? '').toLowerCase();
  const mochiTurns = history.filter((t) => t.role === 'assistant').map((t) => t.content);

  if (mode.kind === 'greet') {
    return mochiTurns.length ? '*floats over* You came back. I was hoping you would.' : '*blinks* Oh, hello. Are you my person?';
  }

  if (mode.kind === 'game' && mode.game === 'riddle') {
    let askedAt = -1;
    history.forEach((t, i) => {
      if (t.role === 'assistant' && RIDDLES.some((r) => t.content.includes(r.q))) askedAt = i;
    });
    const riddle = askedAt >= 0 ? RIDDLES.find((r) => history[askedAt].content.includes(r.q))! : null;
    if (!message || !riddle) return `*puffs up* Riddle time. ${RIDDLES[pet.messages % RIDDLES.length].q}`;
    if (riddle.a.some((a) => said.includes(a))) return `*spins happily* Yes, it's a ${riddle.a[0]}. You're clever.\nRESULT: WIN`;
    const guesses = history.slice(askedAt).filter((t) => t.role === 'user').length + 1;
    if (said.includes('give up') || guesses >= 3) return `*giggles* It was a ${riddle.a[0]}.\nRESULT: LOSE`;
    return `*shakes head* Not quite. Here's a hint: it starts with "${riddle.a[0][0]}".`;
  }

  if (mode.kind === 'game' && mode.game === 'guess') {
    const thing = mode.thing ?? 'an umbrella';
    const word = thing.replace(/^(a|an|the)\s+/, '');
    if (!message) return "*closes eyes* I'm thinking of something. Ask me yes-or-no questions.";
    if (said.includes(word)) return `*gasps* Yes, ${thing}. You found it.\nRESULT: WIN`;
    if (said.includes('give up')) return `*twirls* It was ${thing}.\nRESULT: LOSE`;
    return `${['*thinks* Hmm, sort of.', '*shakes head* No, not really.', '*nods* Yes, a little.'][history.length % 3]} Keep guessing.`;
  }

  if (mode.kind === 'game' && mode.game === 'rather') {
    const last = mochiTurns.at(-1) ?? '';
    const asked = RATHER.find(([a, b]) => last.includes(a) && last.includes(b));
    if (!message || !asked) {
      const [a, b] = RATHER[pet.messages % RATHER.length];
      return `*wiggles* Would you rather ${a} or ${b}?`;
    }
    const pick = asked.find((option) => said.includes(option.split(' ').at(-1)!)) ?? message.trim().slice(0, 60);
    return `*claps* Good pick. I would ${asked[0]} too.\nREMEMBER: Would rather ${pick}\nRESULT: WIN`;
  }

  const line = CHAT[(pet.messages + history.length) % CHAT.length];
  const name = /\bmy name is ([a-z][a-z'-]{1,20})/i.exec(message ?? '')?.[1];
  if (name) return `*bounces* ${capitalize(name)}. What a nice name.\nREMEMBER: Their name is ${capitalize(name)}`;
  const asked = practiceAction(said);
  if (asked) return asked;
  const likes = /\bi (?:really )?(?:love|like) ([^.,!?]{2,40})/i.exec(message ?? '')?.[1];
  if (likes) return `${line}\nREMEMBER: They like ${likes.trim()}`;
  return line;
}
