import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

type Properties = { getProperty(name: string): string | null };
type NormalizedSubmission = {
  responseId: string;
  cabinClass: string;
  scope: string;
  credentialHash: string;
  digest: string;
  [key: string]: unknown;
};
type ScriptApi = {
  normalizeInvitationCode(value: string): string;
  normalizeSubmission(payload: unknown, properties: Properties, version: number): NormalizedSubmission;
  storeSubmission(submission: NormalizedSubmission, properties: Properties): { duplicate: boolean };
  setSheet(sheet: unknown): void;
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function properties(values: Record<string, string>): Properties {
  return { getProperty: (name) => values[name] ?? null };
}

function loadScript(): ScriptApi {
  const source = readFileSync(resolve(process.cwd(), 'integrations/google-apps-script/Code.gs'), 'utf8');
  let activeSheet: unknown = null;
  const context = vm.createContext({
    console,
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: () => activeSheet }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_algorithm: string, value: string) => Array.from(createHash('sha256').update(value).digest())
        .map((byte) => byte > 127 ? byte - 256 : byte),
    },
  });
  vm.runInContext(`${source}\n;globalThis.__testApi = { normalizeInvitationCode: normalizeInvitationCode_, normalizeSubmission: normalizeSubmission_, storeSubmission: storeSubmission_ };`, context);
  const api = (context as unknown as { __testApi: Omit<ScriptApi, 'setSheet'> }).__testApi;
  return { ...api, setSheet: (sheet) => { activeSheet = sheet; } };
}

const responseId = '123e4567-e89b-42d3-a456-426614174000';
const response = (eventId: 'day21' | 'day22') => ({ eventId, attendance: 'attending', partySize: 2 });

describe('Apps Script access credential contract', () => {
  const api = loadScript();
  const codeValues = {
    INVITE_CODE_HASH_ECONOMY: sha256('ALPHA123'),
    INVITE_CODE_HASH_PREMIUM: sha256('BRAVO456'),
    INVITE_CODE_HASH_BUSINESS: sha256('CHARLIE7'),
    INVITE_CODE_HASH_FIRST: sha256('DELTA890'),
  };

  it('normalizes class codes and enforces the server-derived one-day scope', () => {
    expect(api.normalizeInvitationCode('  ａｌｐｈａ‑１２３ ')).toBe('ALPHA123');
    const scriptProperties = properties({ ...codeValues, LEGACY_INVITES_ENABLED: 'false' });
    const valid = api.normalizeSubmission({
      version: 2,
      credential: { kind: 'class-code', value: 'alpha − 123' },
      responseId,
      locale: 'en',
      inviteeName: 'Guest',
      responses: [response('day22')],
    }, scriptProperties, 2);
    expect(valid.cabinClass).toBe('economy');
    expect(valid.scope).toBe('day22');

    expect(() => api.normalizeSubmission({
      version: 2,
      credential: { kind: 'class-code', value: 'ALPHA123' },
      responseId,
      locale: 'en',
      inviteeName: 'Guest',
      responses: [response('day21')],
    }, scriptProperties, 2)).toThrow('invalid_submission');
  });

  it('accepts both invited days for a two-day class code', () => {
    const result = api.normalizeSubmission({
      version: 2,
      credential: { kind: 'class-code', value: 'CHARLIE7' },
      responseId,
      locale: 'ms',
      inviteeName: 'Tetamu',
      responses: [response('day21'), response('day22')],
    }, properties({ ...codeValues }), 2);
    expect(result.cabinClass).toBe('business');
    expect(result.scope).toBe('both-days');
  });

  it('gates legacy requests and preserves their version-1 retry digest', () => {
    const token = `legacy_${'x'.repeat(24)}`;
    const legacyValues = {
      ...codeValues,
      INVITE_TOKEN_HASH_ECONOMY: sha256(token),
      INVITE_TOKEN_HASH_PREMIUM: '2'.repeat(64),
      INVITE_TOKEN_HASH_BUSINESS: '3'.repeat(64),
      INVITE_TOKEN_HASH_FIRST: '4'.repeat(64),
    };
    const payload = {
      responseId,
      locale: 'en',
      inviteeName: 'Guest',
      responses: [response('day22')],
    };

    expect(() => api.normalizeSubmission(
      { version: 1, token, ...payload },
      properties({ ...legacyValues, LEGACY_INVITES_ENABLED: 'false' }),
      1,
    )).toThrow('invalid_credential');

    const enabled = properties({ ...legacyValues, LEGACY_INVITES_ENABLED: 'true' });
    const oldClient = api.normalizeSubmission({ version: 1, token, ...payload }, enabled, 1);
    const newClient = api.normalizeSubmission({
      version: 2,
      credential: { kind: 'legacy-token', value: token },
      ...payload,
    }, enabled, 2);
    expect(newClient.credentialHash).toBe(oldClient.credentialHash);
    expect(newClient.digest).toBe(oldClient.digest);
  });

  it('returns duplicate only for the same stored credential and payload digest', () => {
    const scriptProperties = properties({
      ...codeValues,
      SPREADSHEET_ID: 'private-workbook-id',
    });
    const submission = api.normalizeSubmission({
      version: 2,
      credential: { kind: 'class-code', value: 'ALPHA123' },
      responseId,
      locale: 'en',
      inviteeName: 'Guest',
      responses: [response('day22')],
    }, scriptProperties, 2);
    const finder = {
      matchEntireCell: () => finder,
      findNext: () => ({ getRow: () => 2 }),
    };
    api.setSheet({
      getLastRow: () => 2,
      getRange: (_row: number, column: number) => column === 1
        ? { createTextFinder: () => finder }
        : { getDisplayValues: () => [[submission.credentialHash, submission.digest]] },
    });

    expect(api.storeSubmission(submission, scriptProperties)).toEqual({ duplicate: true });
    expect(() => api.storeSubmission(
      { ...submission, digest: 'f'.repeat(64) },
      scriptProperties,
    )).toThrow('idempotency_conflict');
  });
});
