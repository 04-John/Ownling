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
export const MAX_REPLY_TOKENS = 160;

const STAGE_VOICE: Record<string, string> = {
  egg: 'You are hatching right now. This is the first thing you have ever said: tiny and full of wonder, a few words at most.',
  baby: 'You are a baby: very short, simple words, lots of wonder.',
  child: 'You are a child: playful, curious, short sentences.',
  teen: 'You are a teen: expressive, a little dramatic, fiercely loyal.',
  adult: 'You are grown: calm, wise and affectionate, still playful.',
};

export function systemPrompt(pet: MindPet, memory?: string): string {
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
  ].join('\n\n');
}
