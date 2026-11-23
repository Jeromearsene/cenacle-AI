import path from 'node:path';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

// The development server injects inline styles and opens a WebSocket (hot reload): the strict
// content security policy of the HTML is relaxed in `dev` only.
const relaxCspInDev: Plugin = {
  name: 'relax-csp-in-dev',
  apply: 'serve',
  transformIndexHtml: (html) =>
    html.replace(
      /content="default-src 'none'[^"]*"/,
      `content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:*; img-src 'self' data:"`
    ),
};

// Trois cibles : processus principal, preloads (interface + pages de service), interface
// (Preact + Tailwind 4).
export default defineConfig({
  main: {},
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/preload/index.ts'),
          service: path.resolve(__dirname, 'src/preload/service.ts'),
        },
      },
    },
  },
  renderer: {
    plugins: [preact(), tailwindcss(), relaxCspInDev],
  },
});
