import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

type Properties = { getProperty(name: string): string | null };
type NormalizedSubmission = {
  responseId: string;
  invitationSide: 'groom' | 'bride';
  cabinClass: string;
  scope: string;
  credentialHash: string;
  digest: string;
  [key: string]: unknown;
};
type ScriptApi = {
  normalizeInvitationCode(value: string): string;
  normalizeSubmission(payload: unknown, properties: Properties, version: number): NormalizedSubmission;
  configuredCodeInvitations(properties: Properties): Array<{
    invitationSide: 'groom' | 'bride';
    cabinClass: string;
    scope: string;
    credentialHash: string;
  }>;
  migrateResponseSchema(sheet: unknown): void;
  setSideSummaryFormulas(sheet: unknown, dataRow: number, invitationSide: 'groom' | 'bride'): void;
  setCombinedSummaryFormulas(sheet: unknown, dataRow: number, groomDataRow: number, brideDataRow: number): void;
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
      BorderStyle: { SOLID: 'SOLID' },
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_algorithm: string, value: string) => Array.from(createHash('sha256').update(value).digest())
        .map((byte) => byte > 127 ? byte - 256 : byte),
    },
  });
  vm.runInContext(`${source}\n;globalThis.__testApi = {
    normalizeInvitationCode: normalizeInvitationCode_,
    normalizeSubmission: normalizeSubmission_,
    configuredCodeInvitations: configuredCodeInvitations_,
    migrateResponseSchema: migrateResponseSchema_,
    setSideSummaryFormulas: setSideSummaryFormulas_,
    setCombinedSummaryFormulas: setCombinedSummaryFormulas_,
    storeSubmission: storeSubmission_,
  };`, context);
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
    INVITE_CODE_HASH_BRIDE_ECONOMY: sha256('ECHO1234'),
    INVITE_CODE_HASH_BRIDE_PREMIUM: sha256('FOXTROT9'),
    INVITE_CODE_HASH_BRIDE_BUSINESS: sha256('GOLF1234'),
    INVITE_CODE_HASH_BRIDE_FIRST: sha256('HOTEL567'),
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
    expect(valid.invitationSide).toBe('groom');
    expect(valid.cabinClass).toBe('economy');
    expect(valid.scope).toBe('day22');
    expect(valid.digest).toBe(sha256(JSON.stringify({
      version: 2,
      credentialKind: 'class-code',
      credentialHash: sha256('ALPHA123'),
      responseId,
      locale: 'en',
      inviteeName: 'Guest',
      message: '',
      responses: [response('day22')],
    })));

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
    expect(result.invitationSide).toBe('groom');
    expect(result.cabinClass).toBe('business');
    expect(result.scope).toBe('both-days');
  });

  it('derives every bride-side class and scope from its code', () => {
    const scriptProperties = properties(codeValues);
    const cases = [
      { value: 'ECHO1234', cabinClass: 'economy', scope: 'day21-reception', eventIds: ['day21'] },
      { value: 'FOXTROT9', cabinClass: 'premium-economy', scope: 'day21-reception', eventIds: ['day21'] },
      { value: 'GOLF1234', cabinClass: 'business', scope: 'day21-full', eventIds: ['day21'] },
      { value: 'HOTEL567', cabinClass: 'first', scope: 'both-days', eventIds: ['day21', 'day22'] },
    ] as const;

    cases.forEach((candidate) => {
      const result = api.normalizeSubmission({
        version: 2,
        credential: { kind: 'class-code', value: candidate.value },
        responseId,
        locale: 'en',
        inviteeName: 'Bride-side guest',
        responses: candidate.eventIds.map((eventId) => response(eventId)),
      }, scriptProperties, 2);
      expect(result.invitationSide).toBe('bride');
      expect(result.cabinClass).toBe(candidate.cabinClass);
      expect(result.scope).toBe(candidate.scope);
    });

    expect(() => api.normalizeSubmission({
      version: 2,
      credential: { kind: 'class-code', value: 'ECHO1234' },
      responseId,
      locale: 'en',
      inviteeName: 'Bride-side guest',
      responses: [response('day22')],
    }, scriptProperties, 2)).toThrow('invalid_submission');
  });

  it('requires eight exact lowercase hashes that are globally unique', () => {
    const configured = api.configuredCodeInvitations(properties(codeValues));
    expect(configured).toHaveLength(8);
    expect(configured.map(({ invitationSide, cabinClass, scope }) => ({ invitationSide, cabinClass, scope })))
      .toEqual([
        { invitationSide: 'groom', cabinClass: 'economy', scope: 'day22' },
        { invitationSide: 'groom', cabinClass: 'premium-economy', scope: 'day22' },
        { invitationSide: 'groom', cabinClass: 'business', scope: 'both-days' },
        { invitationSide: 'groom', cabinClass: 'first', scope: 'both-days' },
        { invitationSide: 'bride', cabinClass: 'economy', scope: 'day21-reception' },
        { invitationSide: 'bride', cabinClass: 'premium-economy', scope: 'day21-reception' },
        { invitationSide: 'bride', cabinClass: 'business', scope: 'day21-full' },
        { invitationSide: 'bride', cabinClass: 'first', scope: 'both-days' },
      ]);

    const missingBrideHash: Record<string, string> = { ...codeValues };
    delete missingBrideHash.INVITE_CODE_HASH_BRIDE_FIRST;
    expect(() => api.configuredCodeInvitations(properties(missingBrideHash))).toThrow('not_configured');
    expect(() => api.configuredCodeInvitations(properties({
      ...codeValues,
      INVITE_CODE_HASH_BRIDE_FIRST: 'A'.repeat(64),
    }))).toThrow('not_configured');
    expect(() => api.configuredCodeInvitations(properties({
      ...codeValues,
      INVITE_CODE_HASH_BRIDE_ECONOMY: codeValues.INVITE_CODE_HASH_ECONOMY,
    }))).toThrow('not_configured');
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
    expect(oldClient.invitationSide).toBe('groom');
    expect(newClient.credentialHash).toBe(oldClient.credentialHash);
    expect(newClient.digest).toBe(oldClient.digest);
    expect(oldClient.digest).toBe(sha256(JSON.stringify({
      version: 1,
      tokenHash: sha256(token),
      responseId,
      locale: 'en',
      inviteeName: 'Guest',
      message: '',
      responses: [response('day22')],
    })));
  });

  it('migrates M:N metadata to N:O and backfills old rows as groom without moving A:L', () => {
    const legacyHeaders = [
      'Response ID',
      'Submitted at',
      'Updated at',
      'Cabin class',
      'Invitation scope',
      'Language',
      'Invitee name',
      '21 Aug attendance',
      '21 Aug party size',
      '22 Aug attendance',
      '22 Aug party size',
      'Message',
      'Access credential hash',
      'Payload digest',
    ];
    const originalPublicCells = [
      responseId,
      'submitted',
      'updated',
      'economy',
      'day22',
      'en',
      'Guest',
      '',
      '',
      'attending',
      2,
      'Message',
    ];
    const credentialHash = sha256('ALPHA123');
    const payloadDigest = 'd'.repeat(64);
    const rows: Array<Array<string | number>> = [
      legacyHeaders,
      [...originalPublicCells, credentialHash, payloadDigest],
    ];
    let maxColumns = 14;
    const sheet = {
      getMaxColumns: () => maxColumns,
      insertColumnsAfter: (after: number, count: number) => {
        rows.forEach((row) => row.splice(after, 0, ...Array(count).fill('')));
        maxColumns += count;
      },
      insertColumnBefore: (before: number) => {
        rows.forEach((row) => row.splice(before - 1, 0, ''));
        maxColumns += 1;
      },
      getLastRow: () => rows.length,
      getRange: (row: number, column: number, rowCount: number, columnCount: number) => ({
        getDisplayValues: () => rows.slice(row - 1, row - 1 + rowCount)
          .map((cells) => cells.slice(column - 1, column - 1 + columnCount).map(String)),
        setValues: (values: Array<Array<string | number>>) => {
          values.forEach((valueRow, rowOffset) => valueRow.forEach((value, columnOffset) => {
            rows[row - 1 + rowOffset][column - 1 + columnOffset] = value;
          }));
        },
      }),
    };

    api.migrateResponseSchema(sheet);

    expect(rows[1].slice(0, 12)).toEqual(originalPublicCells);
    expect(rows[1].slice(12, 15)).toEqual(['groom', credentialHash, payloadDigest]);
    expect(rows[0].slice(12, 15)).toEqual(['', 'Access credential hash', 'Payload digest']);
  });

  it('preserves an existing bride side and builds side-separated plus combined summary formulas', () => {
    const rows = [
      Array(15).fill(''),
      Array(15).fill(''),
      Array(15).fill(''),
    ];
    rows[0][12] = 'Invitation side';
    rows[0][13] = 'Access credential hash';
    rows[0][14] = 'Payload digest';
    rows[1][0] = responseId;
    rows[2][0] = '223e4567-e89b-42d3-a456-426614174001';
    rows[1][12] = '';
    rows[2][12] = 'bride';
    const sheet = {
      getMaxColumns: () => 15,
      insertColumnsAfter: () => undefined,
      insertColumnBefore: () => undefined,
      getLastRow: () => rows.length,
      getRange: (row: number, column: number, rowCount: number, columnCount: number) => ({
        getDisplayValues: () => rows.slice(row - 1, row - 1 + rowCount)
          .map((cells) => cells.slice(column - 1, column - 1 + columnCount)),
        setValues: (values: string[][]) => values.forEach((valueRow, rowOffset) => valueRow.forEach((value, columnOffset) => {
          rows[row - 1 + rowOffset][column - 1 + columnOffset] = value;
        })),
      }),
    };
    api.migrateResponseSchema(sheet);
    expect(rows[1][12]).toBe('groom');
    expect(rows[2][12]).toBe('bride');

    const formulas = new Map<string, string>();
    const formulaSheet = {
      getRange: (row: number, column: number) => ({
        setFormula: (formula: string) => {
          formulas.set(`${row}:${column}`, formula);
        },
      }),
    };
    api.setSideSummaryFormulas(formulaSheet, 6, 'groom');
    api.setSideSummaryFormulas(formulaSheet, 15, 'bride');
    api.setCombinedSummaryFormulas(formulaSheet, 24, 6, 15);
    expect(formulas.get('6:2')).toContain('Responses!$M:$M,"groom"');
    expect(formulas.get('15:2')).toContain('Responses!$M:$M,"bride"');
    expect(formulas.get('24:2')).toBe('=SUM(B6,B15)');
    expect(formulas.get('29:6')).toBe('=SUM(B29:E29)');
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
    let metadataColumn = 0;
    api.setSheet({
      getLastRow: () => 2,
      getRange: (_row: number, column: number) => {
        if (column === 1) return { createTextFinder: () => finder };
        metadataColumn = column;
        return { getDisplayValues: () => [[submission.credentialHash, submission.digest]] };
      },
    });

    expect(api.storeSubmission(submission, scriptProperties)).toEqual({ duplicate: true });
    expect(metadataColumn).toBe(14);
    expect(() => api.storeSubmission(
      { ...submission, digest: 'f'.repeat(64) },
      scriptProperties,
    )).toThrow('idempotency_conflict');
  });

  it('appends the visible invitation side at M and private metadata at N:O', () => {
    const scriptProperties = properties({
      ...codeValues,
      SPREADSHEET_ID: 'private-workbook-id',
    });
    const submission = api.normalizeSubmission({
      version: 2,
      credential: { kind: 'class-code', value: 'GOLF1234' },
      responseId,
      locale: 'en',
      inviteeName: 'Bride-side guest',
      message: 'Hello',
      responses: [response('day21')],
    }, scriptProperties, 2);
    let appended: unknown[] = [];
    api.setSheet({
      getLastRow: () => 1,
      appendRow: (row: unknown[]) => { appended = row; },
    });

    expect(api.storeSubmission(submission, scriptProperties)).toEqual({ duplicate: false });
    expect(appended).toHaveLength(15);
    expect(appended.slice(3, 13)).toEqual([
      'business',
      'day21-full',
      'en',
      'Bride-side guest',
      'attending',
      2,
      '',
      '',
      'Hello',
      'bride',
    ]);
    expect(appended.slice(13)).toEqual([submission.credentialHash, submission.digest]);
  });
});
