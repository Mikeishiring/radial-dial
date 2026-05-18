import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Example app — serves the demo page so developers can `npm run example`
// to see the dial without installing it elsewhere. Aliases the package
// name to the local source so changes to src/ are reflected instantly.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@mikeishiring/radial-dial/styles.css',
        replacement: resolve(__dirname, '../src/styles.css'),
      },
      {
        find: '@mikeishiring/radial-dial',
        replacement: resolve(__dirname, '../src/index.ts'),
      },
    ],
  },
  server: {
    port: 5173,
    open: true,
  },
});
