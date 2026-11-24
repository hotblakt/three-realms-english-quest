import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/three-realms-english-quest/' : '/',
  build: {
    rollupOptions: {
      input: {
        game: fileURLToPath(new URL('./index.html', import.meta.url)),
        workbench: fileURLToPath(new URL('./art-workbench/index.html', import.meta.url)),
        forestPreview: fileURLToPath(new URL('./forest-preview/index.html', import.meta.url)),
      },
    },
  },
}));
