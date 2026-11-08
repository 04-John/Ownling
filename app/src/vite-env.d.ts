/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' runs the app on the mock client. */
  readonly VITE_MOCK?: string;
  /** Real-client settings (near-client.ts); all optional with defaults. */
  readonly VITE_CONTRACT_ID?: string;
  readonly VITE_KITCHEN_ID?: string;
  readonly VITE_KITCHEN_URL?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_KEY_LOOKUP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
