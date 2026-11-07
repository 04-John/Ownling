// Reading pets from the Ownling contract and charging them as the kitchen.
import { Account, JsonRpcProvider } from 'near-api-js';
import { config } from './config.ts';

/** `get_pet` as the contract returns it. Amounts are yoctoNEAR strings. */
export type PetView = {
  token_id: string;
  owner_id: string;
  name: string;
  species: string;
  persona: string;
  model: string;
  stage: string;
  born_at: string;
  budget: string;
  kitchen: string;
  daily_cap: string;
  spent_today: string;
  remaining_today: string;
  total_spent: string;
  messages: number;
  bond: number;
  last_fed_at: string;
  last_played_at: string;
  hibernating: boolean;
  has_diary: boolean;
};

export const provider = new JsonRpcProvider({ url: config.rpcUrl });
const kitchen = new Account(
  config.kitchenAccountId,
  provider,
  config.kitchenPrivateKey as `ed25519:${string}`,
);

export async function getPet(tokenId: string): Promise<PetView | null> {
  const pet = await provider.callFunction({
    contractId: config.petsContract,
    method: 'get_pet',
    args: { token_id: tokenId },
  });
  return (pet ?? null) as PetView | null;
}

/** Charge a pet for one thought and return its remaining budget. Throws if the contract refuses. */
export async function charge(tokenId: string, amount: bigint, receipt: string): Promise<string> {
  const budget = await kitchen.callFunction({
    contractId: config.petsContract,
    methodName: 'charge',
    args: { token_id: tokenId, amount: amount.toString(), receipt },
    gas: 30_000_000_000_000n,
  });
  return budget as string;
}

export function formatNear(yocto: string | bigint): string {
  const value = Number(BigInt(yocto) / 10n ** 16n) / 1e8;
  return `${value} NEAR`;
}
