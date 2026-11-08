import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// The app imports ../design (Mochi renderer, tokens) and ../shared, so the dev server must be
// allowed to serve files from the project root.
export default defineConfig({
  // near-api-js's recovery-phrase code (bip39) expects Node's crypto, stream and Buffer.
  plugins: [react(), nodePolyfills({ include: ['crypto', 'stream', 'events', 'util', 'buffer'], globals: { Buffer: true } })],
  server: {
    fs: { allow: ['..'] },
  },
});
