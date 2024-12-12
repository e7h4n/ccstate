import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      input: {
        devtools: 'devtools.html',
        panel: 'panel.html',
      },
    },
  },
});
