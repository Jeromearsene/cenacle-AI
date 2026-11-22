import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

// Le serveur de développement injecte des styles en ligne et ouvre un WebSocket (rechargement
// à chaud) : la politique de sécurité stricte du HTML est relâchée en `dev` uniquement.
const relaxCspInDev: Plugin = {
  name: 'relax-csp-in-dev',
  apply: 'serve',
  transformIndexHtml: (html) =>
    html.replace(
      /content="default-src 'none'[^"]*"/,
      `content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:*; img-src 'self' data:"`
    ),
};

// Trois cibles : processus principal, preload, interface (Preact + Tailwind 4).
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [preact(), tailwindcss(), relaxCspInDev],
  },
});
