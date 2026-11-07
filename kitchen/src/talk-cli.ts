// Talk to a pet from the command line: think on NEAR AI, verify the signed reply, charge the pet.
// Usage: node --env-file=../.env src/talk-cli.ts <token_id> "<message>"
import { think } from './brain.ts';
import { charge, formatNear, getPet } from './chain.ts';
import { costUsd, usdToYocto } from './pricing.ts';

const [tokenId, ...words] = process.argv.slice(2);
const message = words.join(' ');
if (!tokenId || !message) {
  console.error('Usage: node --env-file=../.env src/talk-cli.ts <token_id> "<message>"');
  process.exit(1);
}

const pet = await getPet(tokenId);
if (!pet) throw new Error(`No pet ${tokenId}`);
if (pet.hibernating) {
  console.log(`${pet.name} is hibernating. Feed it to wake it up.`);
  process.exit(0);
}

const thought = await think(pet, [], message);
if (!thought.proof) {
  console.log(`\n${pet.name} (practice mode, not verified, not charged): ${thought.reply}`);
  process.exit(0);
}
const usd = await costUsd(thought.model, thought.usage);
const amount = usdToYocto(usd);
const budget = await charge(tokenId, amount, thought.receipt);

console.log(`\n${pet.name}: ${thought.reply}\n`);
console.log(JSON.stringify({
  model: thought.model,
  usage: thought.usage,
  costUsd: Number(usd.toFixed(6)),
  charged: formatNear(amount),
  budgetLeft: formatNear(budget),
  proof: { kind: thought.proof.kind, signer: thought.proof.signer, hash: thought.proof.hash },
}, null, 2));
