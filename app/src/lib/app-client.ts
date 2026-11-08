// The one place that picks the client. VITE_MOCK=1 runs the app on sample data; otherwise it uses
// the real NEAR client. In mock mode, ?preset=<name> in the URL picks a dev-only starting state.
// Both are loaded lazily, so mock mode never evaluates near-api-js and the production bundle
// drops the mock entirely.
import type { OwnlingClient } from './client';

function devPreset(): string | null {
  return new URLSearchParams(window.location.search).get('preset');
}

export async function createAppClient(): Promise<OwnlingClient> {
  return import.meta.env.VITE_MOCK === '1'
    ? (await import('./mock')).createMockClient(devPreset())
    : (await import('./near-client')).createNearClient();
}
