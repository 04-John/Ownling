import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds dist/wake.html: one file with every script, style and font inlined, so it can be
// opened from disk or hosted anywhere without any Ownling server.
export default defineConfig({
  // near-api-js's recovery-phrase code (bip39) expects Node's crypto, stream and Buffer.
  plugins: [nodePolyfills({ include: ['crypto', 'stream', 'events', 'util', 'buffer'], globals: { Buffer: true } }), viteSingleFile()],
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100_000_000,
    rollupOptions: { input: 'wake.html' },
  },
});
