import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

function githubBase(): string {
  if (process.env.VITE_BASE_PATH) return process.env.VITE_BASE_PATH;
  if (!process.env.GITHUB_ACTIONS) return '/';
  const [owner, repository] = process.env.GITHUB_REPOSITORY?.split('/') ?? [];
  if (!repository || repository === `${owner}.github.io`) return '/';
  return `/${repository}/`;
}

function apiOrigin(): string {
  const configured = process.env.VITE_API_ORIGIN;
  if (!configured) {
    if (process.env.CI) throw new Error('VITE_API_ORIGIN must be configured as the API_ORIGIN repository variable');
    return 'http://localhost:3000';
  }
  const parsed = new URL(configured);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('VITE_API_ORIGIN must be an http(s) origin without a path, query, or credentials');
  }
  if (process.env.CI && parsed.protocol !== 'https:') {
    throw new Error('VITE_API_ORIGIN must use HTTPS in CI');
  }
  return parsed.origin;
}

function publicSiteUrl(): string {
  const configured = process.env.VITE_PUBLIC_SITE_URL;
  if (configured) {
    const parsed = new URL(configured);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error('VITE_PUBLIC_SITE_URL must be a public http(s) URL without credentials, query, or fragment');
    }
    return `${parsed.origin}${parsed.pathname.replace(/\/?$/, '/')}`;
  }
  const [rawOwner, repository] = process.env.GITHUB_REPOSITORY?.split('/') ?? [];
  if (process.env.GITHUB_ACTIONS && rawOwner && repository) {
    const owner = rawOwner.toLowerCase();
    return repository === `${rawOwner}.github.io` || repository === `${owner}.github.io`
      ? `https://${owner}.github.io/`
      : `https://${owner}.github.io/${repository}/`;
  }
  return 'http://127.0.0.1:5173/';
}

function htmlEnvironment(api: string, publicUrl: string, development: boolean): Plugin {
  return {
    name: 'our-flight-html-environment',
    transformIndexHtml(html) {
      return html
        .replace('__API_ORIGIN__', api)
        .replace('__STYLE_POLICY__', development ? "'self' 'unsafe-inline'" : "'self'")
        .split('__PUBLIC_SITE_URL__').join(publicUrl);
    },
  };
}

const resolvedApiOrigin = apiOrigin();
const resolvedPublicSiteUrl = publicSiteUrl();

export default defineConfig(({ command }) => ({
  base: githubBase(),
  plugins: [react(), htmlEnvironment(resolvedApiOrigin, resolvedPublicSiteUrl, command === 'serve')],
  define: {
    'import.meta.env.VITE_API_ORIGIN': JSON.stringify(resolvedApiOrigin),
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
  },
}));
