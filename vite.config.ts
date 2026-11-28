import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { validateRegistry } from './mission-control/registry.mjs';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/three-realms-english-quest/' : '/',
  plugins: [{
    name: 'validate-public-mission-control',
    buildStart() {
      validateRegistry(JSON.parse(readFileSync(new URL('./mission-control/tasks.json', import.meta.url), 'utf8')));
    },
  }, {
    name: 'forest-shared-inline-startup',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const marker = '  <!-- forest-startup -->\n';
        return html.includes(marker) ? html.replace(marker,
          readFileSync(new URL('./forest-batch-b-preview/startup-inline.html', import.meta.url), 'utf8')) : html;
      },
    },
  }],
  build: {
    rollupOptions: {
      input: {
        missionControl: fileURLToPath(new URL('./mission-control/index.html', import.meta.url)),
        game: fileURLToPath(new URL('./index.html', import.meta.url)),
        workbench: fileURLToPath(new URL('./art-workbench/index.html', import.meta.url)),
        forestDiagnostics: fileURLToPath(new URL('./forest-diagnostics/index.html', import.meta.url)),
        forestBatchBPreview: fileURLToPath(new URL('./forest-batch-b-preview/index.html', import.meta.url)),
        forestBatchCPreview: fileURLToPath(new URL('./forest-batch-c-preview/index.html', import.meta.url)),
        forestPreview: fileURLToPath(new URL('./forest-preview/index.html', import.meta.url)),
      },
    },
  },
}));
