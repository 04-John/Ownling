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
  /** 'web' (default), 'android' or 'windows': which copy of the app this build is (platform.ts). */
  readonly VITE_TARGET?: string;
  /** Where the download screen points for the Android and Windows files. */
  readonly VITE_DOWNLOAD_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
