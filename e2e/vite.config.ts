import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { calendarAssets } from '../plugins/calendarAssets';
import { testEnvironment } from './test-config';

// Separate from the deployment config so test runs cannot read local .env files
// or accidentally submit responses using a real Apps Script deployment.
export default defineConfig(({ mode }) => ({
  envDir: false,
  envPrefix: '__E2E_NO_PROCESS_ENV__',
  base: '/',
  server: { hmr: false, watch: null },
  plugins: [react(), calendarAssets(), {
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
  define: Object.fromEntries(Object.entries({
    ...testEnvironment,
    ...(mode === 'demo' ? { VITE_RSVP_STATUS: 'preview', VITE_APPS_SCRIPT_URL: '' } : {}),
  }).map(([key, value]) => [
    `import.meta.env.${key}`, JSON.stringify(value),
  ])),
}));
