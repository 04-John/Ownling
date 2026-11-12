// Try Mochi's mind on NEAR AI without the chain: a greeting with memories, a chat that should be
// remembered, and a round of each game, printing each reply with what parseThought took out.
// Nothing is charged. Usage: node --env-file=../.env src/dev-mind.ts [actions]
import type { Mode } from '../../shared/mind.ts';
import type { PetView } from './chain.ts';
import { think, type Turn } from './brain.ts';

const pet = {
  token_id: '0', owner_id: 'dev.testnet', name: 'Mochi', species: 'cloudling',
  persona: 'A shy, curious cloud creature who loves rain and remembers small kindnesses.',
  model: 'z-ai/glm-5.3-flash', stage: 'child', budget: '490000000000000000000000', daily_cap: '20000000000000000000000',
  spent_today: '0', remaining_today: '20000000000000000000000', kitchen: 'kitchen.ownling.testnet',
  messages: 30, bond: 4, last_played_at: '0', hibernating: false, has_diary: true,
} as unknown as PetView;

async function round(title: string, mode: Mode, says: (string | null)[], memory?: string) {
  console.log(`\n=== ${title}`);
  const history: Turn[] = [];
  for (const said of says) {
    const t = Date.now();
    const thought = await think(pet, history, said, memory, mode);
    if (said) history.push({ role: 'user', content: said });
    history.push({ role: 'assistant', content: thought.reply });
    console.log(`${said ? `you: ${said}\n` : ''}mochi (${Date.now() - t} ms): ${thought.reply}`);
    if (thought.remember.length) console.log(`  remember: ${thought.remember.join(' | ')}`);
    if (thought.result) console.log(`  result: ${thought.result}`);
    if (thought.action) console.log(`  action: ${JSON.stringify(thought.action)}`);
  }
}

// `actions`: only the requests that should (or should not) open something in the app.
if (process.argv[2] === 'actions') {
  const talk: Mode = { kind: 'talk' };
  for (const said of [
    "Mochi, let's play catch the rain!", 'can I feed you? maybe a big storm', 'how much food do you have left?',
    'I love pizza', "let's dress you up", 'what do you want to do today?', 'sing me your tune, I will copy it',
  ]) await round(said, talk, [said]);
  const hungry = { ...pet, budget: '30000000000000000000000' } as PetView;
  const was = Object.assign({}, pet);
  Object.assign(pet, hungry);
  await round('hungry: offer, then yes', talk, ['hi Mochi, how are you?', 'yes!']);
  Object.assign(pet, was);
  process.exit(0);
}

await round('greet with memories', { kind: 'greet' }, [null], '- Their name is Ada\n- Has a maths exam on Friday\nOwner said: wish me luck');
await round('chat that should be remembered', { kind: 'talk' }, ['hi, my name is Tunde and my little sister Bisi turns six tomorrow', 'what should I get her?']);
await round('riddle: wrong, then give up', { kind: 'game', game: 'riddle' }, [null, 'a spoon', 'I give up']);
await round('guess my thing (a penguin)', { kind: 'game', game: 'guess', thing: 'a penguin' }, [null, 'is it an animal?', 'can it fly?', 'is it a penguin?']);
await round('would you rather', { kind: 'game', game: 'rather' }, [null, 'the first one']);
