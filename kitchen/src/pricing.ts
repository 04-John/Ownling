// What a thought costs: NEAR AI's public per-token prices, turned into yoctoNEAR.
import { config } from './config.ts';

type Money = { amount: number; scale: number };
type ModelEntry = {
  modelId: string;
  inputCostPerToken: Money;
  outputCostPerToken: Money;
  metadata?: { verifiable?: boolean; attestationSupported?: boolean };
};
type ModelInfo = { inputUsd: number; outputUsd: number; verifiable: boolean };

let models: Map<string, ModelInfo> | undefined;

async function loadModels(): Promise<Map<string, ModelInfo>> {
  if (models) return models;
  const res = await fetch(`${config.nearAiBaseUrl}/model/list`);
  if (!res.ok) throw new Error(`NEAR AI model list failed: HTTP ${res.status}`);
  const body = (await res.json()) as { models: ModelEntry[] };
  const usd = (m: Money) => m.amount / 10 ** m.scale;
  models = new Map(
    body.models.map((m) => [
      m.modelId,
      {
        inputUsd: usd(m.inputCostPerToken),
        outputUsd: usd(m.outputCostPerToken),
        verifiable: Boolean(m.metadata?.verifiable && m.metadata?.attestationSupported),
      },
    ]),
  );
  return models;
}

/** The pet's pinned model if it runs in a verifiable TEE, otherwise the kitchen default. */
export async function modelFor(pinned: string): Promise<string> {
  const known = await loadModels();
  return known.get(pinned)?.verifiable ? pinned : config.defaultModel;
}

export async function costUsd(
  model: string,
  usage: { prompt_tokens: number; completion_tokens: number },
): Promise<number> {
  const info = (await loadModels()).get(model);
  if (!info) throw new Error(`No price for model ${model}`);
  return usage.prompt_tokens * info.inputUsd + usage.completion_tokens * info.outputUsd;
}

/** Dollar cost plus the kitchen's markup, in yoctoNEAR (rounded up to 1e-12 NEAR). */
export function usdToYocto(usd: number): bigint {
  const near = (usd * config.markup) / config.nearUsd;
  return BigInt(Math.ceil(near * 1e12)) * 10n ** 12n;
}
