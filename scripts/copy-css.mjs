// Copy src/styles.css to dist/radial-dial.css after build.
// We don't import styles.css from src/index.ts (which would auto-inject)
// because we want consumers to opt-in by importing the file themselves.
// This way, consumers with Tailwind never load duplicate utility CSS.

import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '..', 'src', 'styles.css');
const dest = resolve(__dirname, '..', 'dist', 'radial-dial.css');

if (!existsSync(dirname(dest))) {
  mkdirSync(dirname(dest), { recursive: true });
}

copyFileSync(src, dest);
console.log(`  copied  styles.css → dist/radial-dial.css`);
