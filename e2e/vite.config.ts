import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { testEnvironment } from './test-config';

// Separate from the deployment config so test runs cannot read local .env files
// or accidentally submit responses using a real Apps Script deployment.
export default defineConfig({
  envDir: false,
  envPrefix: '__E2E_NO_PROCESS_ENV__',
  base: '/',
  server: { hmr: false, watch: null },
  plugins: [react(), {
    name: 'e2e-html-environment',
    transformIndexHtml(html) {
      const googleSources = "'self' https://script.google.com https://script.googleusercontent.com https://*.googleusercontent.com";
      const replacements: Record<string, string> = {
        __CONNECT_POLICY__: "'self' ws: wss:",
        __FORM_ACTION__: googleSources,
        __FRAME_SOURCES__: googleSources,
        __PUBLIC_SITE_URL__: 'http://127.0.0.1:4173/',
        __STYLE_POLICY__: "'self' 'unsafe-inline'",
      };
      return Object.entries(replacements).reduce(
        (result, [key, value]) => result.split(key).join(value), html,
      );
    },
  }],
  define: Object.fromEntries(Object.entries(testEnvironment).map(([key, value]) => [
    `import.meta.env.${key}`, JSON.stringify(value),
  ])),
});
