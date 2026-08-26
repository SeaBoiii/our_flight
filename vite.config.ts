import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const RSVP_STATUSES = new Set(['preview', 'open', 'closed']);

type BuildEnvironment = Record<string, string>;

function firstValue(environment: BuildEnvironment, ...names: string[]): string {
  for (const name of names) {
    const value = process.env[name] ?? environment[name];
    if (value?.trim()) return value.trim();
  }
  return '';
}

function normaliseBase(value: string): string {
  if (!value) return '/';
  if (!value.startsWith('/') || value.includes('?') || value.includes('#') || value.includes('\\')) {
    throw new Error('VITE_BASE_PATH must be an absolute URL path, such as /our_flight/.');
  }
  return `${value.replace(/\/+$/, '') || ''}/`;
}

function githubBase(environment: BuildEnvironment): string {
  const configured = firstValue(environment, 'VITE_BASE_PATH');
  if (configured) return normaliseBase(configured);
  if (!process.env.GITHUB_ACTIONS) return '/';

  const [owner, repository] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
  if (!owner || !repository) throw new Error('GITHUB_REPOSITORY is required for a GitHub Pages build.');
  if (repository.toLowerCase() === `${owner.toLowerCase()}.github.io`) return '/';
  return `/${repository}/`;
}

function publicSiteUrl(environment: BuildEnvironment, base: string): string {
  const configured = firstValue(environment, 'VITE_PUBLIC_SITE_URL');
  if (configured) {
    const parsed = new URL(configured);
    if (
      parsed.protocol !== 'https:'
      || parsed.username
      || parsed.password
      || parsed.search
      || parsed.hash
    ) {
      throw new Error('VITE_PUBLIC_SITE_URL must be a public HTTPS URL without credentials, query, or fragment.');
    }
    return `${parsed.origin}${parsed.pathname.replace(/\/?$/, '/')}`;
  }

  const [owner, repository] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
  if (process.env.GITHUB_ACTIONS && owner && repository) {
    return `https://${owner.toLowerCase()}.github.io${base}`;
  }
  return 'http://127.0.0.1:5173/';
}

function canonicalAppsScriptUrl(value: string): string {
  if (!value) return '';
  const parsed = new URL(value);
  if (
    parsed.protocol !== 'https:'
    || parsed.hostname !== 'script.google.com'
    || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(parsed.pathname)
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new Error('VITE_APPS_SCRIPT_URL must be a canonical https://script.google.com/macros/s/.../exec URL.');
  }
  return parsed.toString();
}

function validateHashes(passcodeHash: string, invitationHashes: Record<string, string>): void {
  const entries = Object.entries({ passcode: passcodeHash, ...invitationHashes });
  const invalid = entries.filter(([, value]) => !SHA256_PATTERN.test(value)).map(([name]) => name);
  if (invalid.length) {
    throw new Error(`Missing or invalid SHA-256 build values: ${invalid.join(', ')}.`);
  }

  const normalisedInvitationHashes = Object.values(invitationHashes).map((hash) => hash.toLowerCase());
  if (new Set(normalisedInvitationHashes).size !== normalisedInvitationHashes.length) {
    throw new Error('Each invitation class must use a different token hash.');
  }
}

function htmlEnvironment({
  appsScriptUrl,
  development,
  publicUrl,
}: {
  appsScriptUrl: string;
  development: boolean;
  publicUrl: string;
}): Plugin {
  const formAction = appsScriptUrl
    ? "'self' https://script.google.com https://script.googleusercontent.com https://*.googleusercontent.com"
    : "'self'";
  const frameSources = appsScriptUrl
    ? "'self' https://script.google.com https://script.googleusercontent.com https://*.googleusercontent.com"
    : "'self'";
  const replacements: Record<string, string> = {
    __CONNECT_POLICY__: development ? "'self' ws: wss:" : "'self'",
    __FORM_ACTION__: formAction,
    __FRAME_SOURCES__: frameSources,
    __PUBLIC_SITE_URL__: publicUrl,
    __STYLE_POLICY__: development ? "'self' 'unsafe-inline'" : "'self'",
  };

  return {
    name: 'our-flight-html-environment',
    transformIndexHtml(html) {
      return Object.entries(replacements).reduce(
        (result, [placeholder, value]) => result.split(placeholder).join(value),
        html,
      );
    },
  };
}

export default defineConfig(({ command, mode }) => {
  // Loading with an empty prefix supports the ignored legacy local keys. Only
  // the explicit values below are compiled into the public application.
  const environment = loadEnv(mode, process.cwd(), '');
  const passcodeHash = firstValue(environment, 'VITE_PASSCODE_HASH', 'WEDDING_PASSCODE_HASH');
  const invitationHashes = {
    economy: firstValue(environment, 'VITE_INVITE_HASH_ECONOMY', 'INVITE_TOKEN_HASH_ECONOMY'),
    premium: firstValue(environment, 'VITE_INVITE_HASH_PREMIUM', 'INVITE_TOKEN_HASH_PREMIUM'),
    business: firstValue(environment, 'VITE_INVITE_HASH_BUSINESS', 'INVITE_TOKEN_HASH_BUSINESS'),
    first: firstValue(environment, 'VITE_INVITE_HASH_FIRST', 'INVITE_TOKEN_HASH_FIRST'),
  };
  const status = firstValue(environment, 'VITE_RSVP_STATUS', 'RSVP_STATUS') || 'preview';
  if (!RSVP_STATUSES.has(status)) throw new Error('VITE_RSVP_STATUS must be preview, open, or closed.');

  const appsScriptUrl = canonicalAppsScriptUrl(firstValue(environment, 'VITE_APPS_SCRIPT_URL', 'APPS_SCRIPT_URL'));
  if (status === 'open' && !appsScriptUrl) {
    throw new Error('VITE_APPS_SCRIPT_URL is required when VITE_RSVP_STATUS=open.');
  }
  if (command === 'build') validateHashes(passcodeHash, invitationHashes);

  const base = githubBase(environment);
  const publicUrl = publicSiteUrl(environment, base);

  return {
    base,
    plugins: [react(), htmlEnvironment({ appsScriptUrl, development: command === 'serve', publicUrl })],
    define: {
      'import.meta.env.VITE_APPS_SCRIPT_URL': JSON.stringify(appsScriptUrl),
      'import.meta.env.VITE_INVITE_HASH_BUSINESS': JSON.stringify(invitationHashes.business),
      'import.meta.env.VITE_INVITE_HASH_ECONOMY': JSON.stringify(invitationHashes.economy),
      'import.meta.env.VITE_INVITE_HASH_FIRST': JSON.stringify(invitationHashes.first),
      'import.meta.env.VITE_INVITE_HASH_PREMIUM': JSON.stringify(invitationHashes.premium),
      'import.meta.env.VITE_PASSCODE_HASH': JSON.stringify(passcodeHash),
      'import.meta.env.VITE_RSVP_STATUS': JSON.stringify(status),
    },
    build: {
      assetsInlineLimit: 4_096,
      cssCodeSplit: true,
      sourcemap: false,
      target: 'es2022',
    },
  };
});
