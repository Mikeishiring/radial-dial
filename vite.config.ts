import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

// Library build — outputs ESM + CJS + .d.ts.
// React, react-dom, and framer-motion are peer deps (externalized) so the
// host app provides them. Keeps the bundle small and avoids duplicate React.
export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      include: ['src/**/*'],
      exclude: ['example/**/*', 'src/**/*.test.*'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'RadialDial',
      formats: ['es', 'cjs'],
      fileName: (format) => `radial-dial.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'framer-motion'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
          'framer-motion': 'framerMotion',
        },
      },
    },
    sourcemap: true,
    minify: false, // Libraries should leave minification to the consumer's bundler.
  },
});
