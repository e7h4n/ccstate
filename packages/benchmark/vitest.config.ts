import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import codspeedPlugin from '@codspeed/vitest-plugin';

const plugins: Plugin[] = [];
if (process.env.CI === 'true') {
  plugins.push(codspeedPlugin());
}
export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
  plugins: plugins as any,
});
