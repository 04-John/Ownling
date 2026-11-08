// Kitchen settings, read once from the environment (`node --env-file=../.env`).

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing from .env`);
  return value;
}

export const config = {
  nearAiApiKey: required('NEAR_AI_API_KEY'),
  nearAiBaseUrl: process.env.NEAR_AI_BASE_URL ?? 'https://cloud-api.near.ai/v1',
  /** Used when a pet's pinned model isn't a verifiable TEE model. */
  defaultModel: process.env.PET_MODEL ?? 'z-ai/glm-5.3-flash',
  rpcUrl: process.env.NEAR_RPC_URL ?? 'https://test.rpc.fastnear.com',
  petsContract: required('PETS_CONTRACT'),
  kitchenAccountId: required('KITCHEN_ACCOUNT_ID'),
  kitchenPrivateKey: required('KITCHEN_PRIVATE_KEY'),
  /** USD price of 1 NEAR, used to turn a message's dollar cost into NEAR. */
  nearUsd: Number(process.env.NEAR_USD ?? '3.68'),
  /** Kitchen margin over the raw inference cost. */
  markup: Number(process.env.KITCHEN_MARKUP ?? '1.25'),
  /** Parent of new players' accounts (cloud-1234.<sponsor>); sign-up is off without its key. */
  sponsorAccountId: process.env.SPONSOR_ACCOUNT_ID ?? '',
  sponsorPrivateKey: process.env.SPONSOR_PRIVATE_KEY ?? '',
  /** Test NEAR each new player starts with: adoption (0.5) plus a few feeds and gas. */
  playerStarterNear: process.env.PLAYER_STARTER_NEAR ?? '1',
};
