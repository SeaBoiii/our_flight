import { createHash } from 'node:crypto';

// Deliberately public, fake credentials. These hashes are injected only by the
// isolated E2E server and are never imported by the application or a release build.
export const testCodes = {
  ECONOMY: 'E2EGROOM01',
  PREMIUM: 'E2EGROOM02',
  BUSINESS: 'E2EGROOM03',
  FIRST: 'E2EGROOM04',
  BRIDE_ECONOMY: 'E2EBRIDE01',
  BRIDE_PREMIUM: 'E2EBRIDE02',
  BRIDE_BUSINESS: 'E2EBRIDE03',
  BRIDE_FIRST: 'E2EBRIDE04',
} as const;

export const testEndpoint = 'https://script.google.com/macros/s/E2E_TEST_ONLY/exec';

export const testEnvironment = {
  ...Object.fromEntries(Object.entries(testCodes).map(([profile, code]) => [
    `VITE_INVITE_CODE_HASH_${profile}`,
    createHash('sha256').update(code).digest('hex'),
  ])),
  VITE_APPS_SCRIPT_URL: testEndpoint,
  VITE_RSVP_STATUS: 'open',
  VITE_GALLERY_URL: 'https://gallery.example.test/',
  // Fake numbers only: real family contacts live in a GitHub repository variable.
  VITE_FAMILY_CONTACTS: JSON.stringify({
    day21: [{ name: 'Wahab family (test)', role: { en: "Bride's father", ms: 'Bapa pengantin perempuan' }, phone: '+65 9000 0001' }],
    day22: [{ name: 'Jamal family (test)', role: { en: "Groom's father", ms: 'Bapa pengantin lelaki' }, phone: '+65 8000 0002' }],
  }),
  VITE_LEGACY_INVITES_ENABLED: 'false',
  VITE_PASSCODE_HASH: '',
  VITE_INVITE_HASH_ECONOMY: '',
  VITE_INVITE_HASH_PREMIUM: '',
  VITE_INVITE_HASH_BUSINESS: '',
  VITE_INVITE_HASH_FIRST: '',
};
