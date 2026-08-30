/**
 * Bound Google Apps Script for the private Aleem & Nurulain RSVP workbook.
 *
 * The public GitHub Pages app posts a regular HTML form into a hidden iframe.
 * This web app validates the access credential, writes the response, and
 * returns a tiny HTML page that posts a correlated receipt to the top-level page.
 *
 * Required Script Properties:
 *   RSVP_STATUS                       preview | open | closed
 *   PARENT_ORIGIN                     e.g. https://account.github.io
 *   INVITE_CODE_HASH_ECONOMY          lowercase SHA-256 hex
 *   INVITE_CODE_HASH_PREMIUM          lowercase SHA-256 hex
 *   INVITE_CODE_HASH_BUSINESS         lowercase SHA-256 hex
 *   INVITE_CODE_HASH_FIRST            lowercase SHA-256 hex
 *   INVITE_CODE_HASH_BRIDE_ECONOMY    lowercase SHA-256 hex
 *   INVITE_CODE_HASH_BRIDE_PREMIUM    lowercase SHA-256 hex
 *   INVITE_CODE_HASH_BRIDE_BUSINESS   lowercase SHA-256 hex
 *   INVITE_CODE_HASH_BRIDE_FIRST      lowercase SHA-256 hex
 *   LEGACY_INVITES_ENABLED            true | false (defaults to false)
 *
 * setupWorkbook() records SPREADSHEET_ID automatically. Never store raw
 * invitation codes, legacy tokens, or the wedding passcode in Script Properties.
 */

const RESPONSES_SHEET = 'Responses';
const SUMMARY_SHEET = 'Summary';
const SPREADSHEET_ID_PROPERTY = 'SPREADSHEET_ID';
const RSVP_STATUS_PROPERTY = 'RSVP_STATUS';
const PARENT_ORIGIN_PROPERTY = 'PARENT_ORIGIN';
const BRIDGE_TYPE = 'our-flight:rsvp-result';
const CURRENT_BRIDGE_VERSION = 2;
const LEGACY_BRIDGE_VERSION = 1;
const MAX_PAYLOAD_LENGTH = 16384;
const PUBLIC_RESPONSE_COLUMNS = 13;
const LEGACY_RESPONSE_COLUMNS = 14;
const RESPONSE_HEADERS = [
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
  'Invitation side',
  'Access credential hash',
  'Payload digest',
];
const CODE_INVITATIONS = [
  { invitationSide: 'groom', cabinClass: 'economy', scope: 'day22', property: 'INVITE_CODE_HASH_ECONOMY' },
  { invitationSide: 'groom', cabinClass: 'premium-economy', scope: 'day22', property: 'INVITE_CODE_HASH_PREMIUM' },
  { invitationSide: 'groom', cabinClass: 'business', scope: 'both-days', property: 'INVITE_CODE_HASH_BUSINESS' },
  { invitationSide: 'groom', cabinClass: 'first', scope: 'both-days', property: 'INVITE_CODE_HASH_FIRST' },
  { invitationSide: 'bride', cabinClass: 'economy', scope: 'day21-reception', property: 'INVITE_CODE_HASH_BRIDE_ECONOMY' },
  { invitationSide: 'bride', cabinClass: 'premium-economy', scope: 'day21-reception', property: 'INVITE_CODE_HASH_BRIDE_PREMIUM' },
  { invitationSide: 'bride', cabinClass: 'business', scope: 'day21-full', property: 'INVITE_CODE_HASH_BRIDE_BUSINESS' },
  { invitationSide: 'bride', cabinClass: 'first', scope: 'both-days', property: 'INVITE_CODE_HASH_BRIDE_FIRST' },
];
const LEGACY_INVITATIONS = [
  { invitationSide: 'groom', cabinClass: 'economy', scope: 'day22', property: 'INVITE_TOKEN_HASH_ECONOMY' },
  { invitationSide: 'groom', cabinClass: 'premium-economy', scope: 'day22', property: 'INVITE_TOKEN_HASH_PREMIUM' },
  { invitationSide: 'groom', cabinClass: 'business', scope: 'both-days', property: 'INVITE_TOKEN_HASH_BUSINESS' },
  { invitationSide: 'groom', cabinClass: 'first', scope: 'both-days', property: 'INVITE_TOKEN_HASH_FIRST' },
];

function setupWorkbook() {
  const workbook = SpreadsheetApp.getActiveSpreadsheet();
  if (!workbook) throw new Error('Bind this script to the private RSVP spreadsheet before setup.');

  workbook.setSpreadsheetTimeZone('Asia/Singapore');
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_PROPERTY, workbook.getId());

  let responses = workbook.getSheetByName(RESPONSES_SHEET);
  if (!responses) {
    const firstSheet = workbook.getSheets()[0];
    const firstSheetIsBlank = firstSheet.getLastRow() === 0 && firstSheet.getLastColumn() === 0;
    responses = firstSheetIsBlank ? firstSheet.setName(RESPONSES_SHEET) : workbook.insertSheet(RESPONSES_SHEET);
  }

  let summary = workbook.getSheetByName(SUMMARY_SHEET);
  if (!summary) summary = workbook.insertSheet(SUMMARY_SHEET);

  formatResponsesSheet_(responses);
  formatSummarySheet_(summary);
  workbook.setActiveSheet(summary);
  SpreadsheetApp.flush();
}

/**
 * Safe, secret-free configuration check. Run it in the editor after entering
 * Script Properties. It throws on a missing or malformed value and logs only
 * non-sensitive status information.
 */
function verifyConfiguration() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty(SPREADSHEET_ID_PROPERTY);
  if (!spreadsheetId) throw new Error('Run setupWorkbook() first.');
  if (!SpreadsheetApp.openById(spreadsheetId).getSheetByName(RESPONSES_SHEET)) {
    throw new Error('Responses sheet is missing. Run setupWorkbook() again.');
  }

  const status = rsvpStatus_(properties);
  configuredParentOrigin_(properties);
  configuredCodeInvitations_(properties);
  const legacyEnabled = legacyInvitesEnabled_(properties);
  if (legacyEnabled) configuredLegacyInvitations_(properties);
  console.log('Configuration valid. RSVP status: %s. Legacy invitations: %s.', status, legacyEnabled);
  return {
    ok: true,
    rsvpStatus: status,
    invitationClasses: 4,
    invitationSides: 2,
    invitationCredentials: CODE_INVITATIONS.length,
    legacyInvitesEnabled: legacyEnabled,
  };
}

function doPost(event) {
  let nonce = '';
  let responseId = '';
  let responseVersion = CURRENT_BRIDGE_VERSION;
  const properties = PropertiesService.getScriptProperties();

  try {
    const parameters = event && event.parameter ? event.parameter : {};
    const requestedVersion = Number(parameters.bridgeVersion);
    if (requestedVersion === CURRENT_BRIDGE_VERSION || requestedVersion === LEGACY_BRIDGE_VERSION) {
      responseVersion = requestedVersion;
    }

    nonce = requiredUuid_(parameters.nonce, 'nonce');
    const payloadText = typeof parameters.payload === 'string' ? parameters.payload : '';
    if (!payloadText || payloadText.length > MAX_PAYLOAD_LENGTH) {
      throw validationError_(payloadText ? 'request_too_large' : 'invalid_submission', ['payload']);
    }

    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch (error) {
      throw validationError_('invalid_submission', ['payload']);
    }

    // Validate the response ID before the status gate so preview/closed replies
    // remain correlated and the browser can report them without timing out.
    responseId = requiredUuid_(payload && payload.responseId, 'responseId');

    const legacyRequestAllowed = requestedVersion === LEGACY_BRIDGE_VERSION && legacyInvitesEnabled_(properties);
    if (requestedVersion !== CURRENT_BRIDGE_VERSION && !legacyRequestAllowed) {
      throw validationError_('unsupported_bridge', ['bridgeVersion']);
    }

    const status = rsvpStatus_(properties);
    if (status !== 'open') throw validationError_(status, []);

    // A valid parent origin is required before accepting writes. postMessage
    // still falls back to "*" for configuration-error receipts only.
    configuredParentOrigin_(properties);
    const submission = normalizeSubmission_(payload, properties, requestedVersion);

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw validationError_('busy', []);

    let result;
    try {
      result = storeSubmission_(submission, properties);
    } finally {
      lock.releaseLock();
    }

    return bridgeHtml_({
      type: BRIDGE_TYPE,
      version: responseVersion,
      nonce: nonce,
      responseId: responseId,
      ok: true,
      duplicate: result.duplicate,
    }, properties);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    const code = error && error.publicCode ? error.publicCode : 'server_error';
    const fields = error && Array.isArray(error.fields) ? error.fields : [];
    return bridgeHtml_({
      type: BRIDGE_TYPE,
      version: responseVersion,
      nonce: nonce,
      responseId: responseId,
      ok: false,
      error: code,
      fields: fields,
    }, properties);
  }
}

function normalizeSubmission_(payload, properties, bridgeVersion) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw validationError_('invalid_submission', ['payload']);
  }
  if (payload.version !== bridgeVersion) {
    throw validationError_('invalid_submission', ['version']);
  }

  let credentialKind;
  let credentialValue;
  let invitation;
  if (bridgeVersion === LEGACY_BRIDGE_VERSION) {
    if (!legacyInvitesEnabled_(properties) || typeof payload.token !== 'string' || !/^[A-Za-z0-9_-]{20,160}$/.test(payload.token)) {
      throw validationError_('invalid_credential', ['credential']);
    }
    credentialKind = 'legacy-token';
    credentialValue = payload.token;
    invitation = invitationForCredential_(credentialValue, configuredLegacyInvitations_(properties));
  } else {
    const credential = payload.credential;
    if (!credential || typeof credential !== 'object' || Array.isArray(credential)) {
      throw validationError_('invalid_credential', ['credential']);
    }
    credentialKind = requiredChoice_(credential.kind, ['class-code', 'legacy-token'], 'credential.kind');
    if (typeof credential.value !== 'string') throw validationError_('invalid_credential', ['credential.value']);
    if (credentialKind === 'class-code') {
      credentialValue = normalizeInvitationCode_(credential.value);
      if (!/^[A-Z0-9]{8,12}$/.test(credentialValue)) throw validationError_('invalid_credential', ['credential']);
      invitation = invitationForCredential_(credentialValue, configuredCodeInvitations_(properties));
    } else {
      if (!legacyInvitesEnabled_(properties) || !/^[A-Za-z0-9_-]{20,160}$/.test(credential.value)) {
        throw validationError_('invalid_credential', ['credential']);
      }
      credentialValue = credential.value;
      invitation = invitationForCredential_(credentialValue, configuredLegacyInvitations_(properties));
    }
  }
  if (!invitation) throw validationError_('invalid_credential', ['credential']);
  const credentialHash = sha256Hex_(credentialValue);

  const responseId = requiredUuid_(payload.responseId, 'responseId');
  const locale = requiredChoice_(payload.locale, ['en', 'ms'], 'locale');
  const inviteeName = requiredText_(payload.inviteeName, 100, 'inviteeName');
  const message = optionalText_(payload.message, 500, 'message');
  const responses = normalizeResponses_(payload.responses, invitation.scope);

  // Preserve the original version-1 digest for all legacy-token requests so a
  // retry made after the Pages upgrade still matches a row created beforehand.
  const canonical = credentialKind === 'legacy-token' ? {
    version: LEGACY_BRIDGE_VERSION,
    tokenHash: credentialHash,
    responseId: responseId,
    locale: locale,
    inviteeName: inviteeName,
    message: message,
    responses: responses,
  } : {
    version: CURRENT_BRIDGE_VERSION,
    credentialKind: credentialKind,
    credentialHash: credentialHash,
    responseId: responseId,
    locale: locale,
    inviteeName: inviteeName,
    message: message,
    responses: responses,
  };

  return {
    responseId: responseId,
    invitationSide: invitation.invitationSide,
    cabinClass: invitation.cabinClass,
    scope: invitation.scope,
    locale: locale,
    inviteeName: inviteeName,
    message: message,
    responses: responses,
    credentialHash: credentialHash,
    digest: sha256Hex_(JSON.stringify(canonical)),
  };
}

function normalizeResponses_(value, scope) {
  if (!Array.isArray(value)) throw validationError_('invalid_submission', ['responses']);

  const expectedIdsByScope = {
    'day21-reception': ['day21'],
    'day21-full': ['day21'],
    'day22': ['day22'],
    'both-days': ['day21', 'day22'],
  };
  const expectedIds = expectedIdsByScope[scope];
  if (!expectedIds) throw validationError_('invalid_submission', ['responses']);
  if (value.length !== expectedIds.length) throw validationError_('invalid_submission', ['responses']);

  const byId = {};
  value.forEach(function (answer, index) {
    const prefix = 'responses[' + index + ']';
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
      throw validationError_('invalid_submission', [prefix]);
    }
    const eventId = requiredChoice_(answer.eventId, expectedIds, prefix + '.eventId');
    if (byId[eventId]) throw validationError_('invalid_submission', [prefix + '.eventId']);
    byId[eventId] = normalizeEvent_(answer, eventId);
  });

  expectedIds.forEach(function (eventId) {
    if (!byId[eventId]) throw validationError_('invalid_submission', ['responses.' + eventId]);
  });
  return expectedIds.map(function (eventId) { return byId[eventId]; });
}

function normalizeEvent_(value, field) {
  const attendance = requiredChoice_(value.attendance, ['attending', 'not-attending'], field + '.attendance');
  if (attendance === 'not-attending') {
    if (value.partySize !== undefined && value.partySize !== null && value.partySize !== '') {
      throw validationError_('invalid_submission', [field + '.partySize']);
    }
    return { eventId: value.eventId, attendance: attendance };
  }

  if (typeof value.partySize !== 'number' || !Number.isSafeInteger(value.partySize) || value.partySize < 1) {
    throw validationError_('invalid_submission', [field + '.partySize']);
  }
  return { eventId: value.eventId, attendance: attendance, partySize: value.partySize };
}

function storeSubmission_(submission, properties) {
  const spreadsheetId = properties.getProperty(SPREADSHEET_ID_PROPERTY);
  if (!spreadsheetId) throw validationError_('not_configured', []);

  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(RESPONSES_SHEET);
  if (!sheet) throw validationError_('not_configured', []);
  const existingRow = findResponseRow_(sheet, submission.responseId);

  if (existingRow) {
    const metadata = sheet.getRange(existingRow, PUBLIC_RESPONSE_COLUMNS + 1, 1, 2).getDisplayValues()[0];
    const sameCredential = timingSafeEqual_(String(metadata[0] || '').toLowerCase(), submission.credentialHash);
    const samePayload = timingSafeEqual_(String(metadata[1] || '').toLowerCase(), submission.digest);
    if (!sameCredential || !samePayload) throw validationError_('idempotency_conflict', ['responseId']);
    return { duplicate: true };
  }

  const now = new Date();
  const answers = {};
  submission.responses.forEach(function (answer) { answers[answer.eventId] = answer; });
  const day21 = answers.day21 || {};
  const day22 = answers.day22 || {};
  const row = [
    safeSheetText_(submission.responseId),
    now,
    now,
    submission.cabinClass,
    submission.scope,
    submission.locale,
    safeSheetText_(submission.inviteeName),
    day21.attendance || '',
    day21.partySize || '',
    day22.attendance || '',
    day22.partySize || '',
    safeSheetText_(submission.message),
    submission.invitationSide,
    submission.credentialHash,
    submission.digest,
  ];
  sheet.appendRow(row);
  return { duplicate: false };
}

function configuredCodeInvitations_(properties) {
  return configuredInvitationSet_(properties, CODE_INVITATIONS);
}

function configuredLegacyInvitations_(properties) {
  return configuredInvitationSet_(properties, LEGACY_INVITATIONS);
}

function configuredInvitationSet_(properties, definitions) {
  const seen = {};
  return definitions.map(function (invitation) {
    const credentialHash = String(properties.getProperty(invitation.property) || '');
    if (!isSha256_(credentialHash) || seen[credentialHash]) throw validationError_('not_configured', []);
    seen[credentialHash] = true;
    return {
      invitationSide: invitation.invitationSide,
      cabinClass: invitation.cabinClass,
      scope: invitation.scope,
      credentialHash: credentialHash,
    };
  });
}

function invitationForCredential_(value, invitations) {
  const credentialHash = sha256Hex_(value);
  return invitations.find(function (candidate) {
    return timingSafeEqual_(candidate.credentialHash, credentialHash);
  });
}

function normalizeInvitationCode_(value) {
  return String(value).normalize('NFKC').trim().toUpperCase()
    .replace(/[\s\u002D\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]+/g, '');
}

function legacyInvitesEnabled_(properties) {
  const value = String(properties.getProperty('LEGACY_INVITES_ENABLED') || 'false').trim().toLowerCase();
  if (value !== 'true' && value !== 'false') throw validationError_('not_configured', []);
  return value === 'true';
}

function rsvpStatus_(properties) {
  const value = String(properties.getProperty(RSVP_STATUS_PROPERTY) || 'preview').trim().toLowerCase();
  if (value !== 'preview' && value !== 'open' && value !== 'closed') {
    throw validationError_('not_configured', []);
  }
  return value;
}

function configuredParentOrigin_(properties) {
  const origin = String(properties.getProperty(PARENT_ORIGIN_PROPERTY) || '').trim();
  if (!/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?$/.test(origin)) {
    throw validationError_('not_configured', []);
  }
  return origin;
}

function parentOriginForReceipt_(properties) {
  try {
    return configuredParentOrigin_(properties);
  } catch (error) {
    return '*';
  }
}

function bridgeHtml_(receipt, properties) {
  const safeReceipt = JSON.stringify(receipt)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const targetOrigin = JSON.stringify(parentOriginForReceipt_(properties));
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>RSVP receipt</title></head>'
    // HtmlService renders this page inside an additional Google-hosted frame.
    // `parent` is therefore the Google wrapper; `top` is the GitHub Pages app.
    + '<body><script>window.top.postMessage(' + safeReceipt + ',' + targetOrigin + ');<\/script></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width,initial-scale=1');
}

function requiredText_(value, maxLength, field) {
  if (typeof value !== 'string') throw validationError_('invalid_submission', [field]);
  const result = value.trim();
  if (!result || result.length > maxLength) throw validationError_('invalid_submission', [field]);
  return result;
}

function optionalText_(value, maxLength, field) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw validationError_('invalid_submission', [field]);
  const result = value.trim();
  if (result.length > maxLength) throw validationError_('invalid_submission', [field]);
  return result;
}

function requiredChoice_(value, choices, field) {
  if (choices.indexOf(value) === -1) throw validationError_('invalid_submission', [field]);
  return value;
}

function requiredUuid_(value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw validationError_('invalid_submission', [field]);
  }
  return value.toLowerCase();
}

function validationError_(code, fields) {
  const error = new Error(code);
  error.publicCode = code;
  error.fields = fields || [];
  return error;
}

function safeSheetText_(value) {
  const text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function isSha256_(value) {
  return /^[a-f0-9]{64}$/.test(value);
}

function sha256Hex_(value) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  ).map(function (byte) {
    return ((byte + 256) % 256).toString(16).padStart(2, '0');
  }).join('');
}

function timingSafeEqual_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

function findResponseRow_(sheet, responseId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const match = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .createTextFinder(responseId)
    .matchEntireCell(true)
    .findNext();
  return match ? match.getRow() : null;
}

function ensureResponseColumnCapacity_(sheet, width) {
  const maxColumns = sheet.getMaxColumns();
  if (maxColumns < width) sheet.insertColumnsAfter(maxColumns, width - maxColumns);
}

/**
 * Version 1 of the workbook stored credential metadata in M:N. Insert the new
 * public side column at M so A:L never move, then retain the metadata verbatim
 * in N:O. Blank side cells in existing rows are old groom-side submissions.
 */
function migrateResponseSchema_(sheet) {
  ensureResponseColumnCapacity_(sheet, LEGACY_RESPONSE_COLUMNS);
  const metadataHeaders = sheet.getRange(1, PUBLIC_RESPONSE_COLUMNS, 1, 2).getDisplayValues()[0];
  const isLegacySchema = metadataHeaders[0] === 'Access credential hash'
    && metadataHeaders[1] === 'Payload digest';
  const isCurrentSchema = metadataHeaders[0] === 'Invitation side'
    && metadataHeaders[1] === 'Access credential hash';
  const isBlankSchema = metadataHeaders[0] === '' && metadataHeaders[1] === '';

  if (isLegacySchema) {
    sheet.insertColumnBefore(PUBLIC_RESPONSE_COLUMNS);
  } else if (!isCurrentSchema && !isBlankSchema) {
    throw new Error('Responses sheet metadata columns are not recognized. Restore the expected headers before setup.');
  }

  ensureResponseColumnCapacity_(sheet, RESPONSE_HEADERS.length);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const sideRange = sheet.getRange(2, PUBLIC_RESPONSE_COLUMNS, lastRow - 1, 1);
  const sides = sideRange.getDisplayValues();
  const responseIds = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  let changed = false;
  const backfilled = sides.map(function (row, index) {
    if (String(row[0] || '').trim() !== '' || String(responseIds[index][0] || '').trim() === '') return [row[0]];
    changed = true;
    return ['groom'];
  });
  if (changed) sideRange.setValues(backfilled);
}

function formatResponsesSheet_(sheet) {
  migrateResponseSchema_(sheet);
  const width = RESPONSE_HEADERS.length;
  sheet.getRange(1, 1, 1, width).setValues([RESPONSE_HEADERS]);
  sheet.setFrozenRows(1);
  sheet.setTabColor('#17606a');
  sheet.getRange(1, 1, 1, width)
    .setBackground('#0a3640')
    .setFontColor('#fff7e8')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange(2, 2, Math.max(sheet.getMaxRows() - 1, 1), 2).setNumberFormat('dd mmm yyyy, hh:mm:ss');
  sheet.getRange(2, 9, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('0');
  sheet.getRange(2, 11, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('0');
  sheet.setColumnWidth(1, 265);
  sheet.setColumnWidths(2, 2, 155);
  sheet.setColumnWidth(4, 140);
  sheet.setColumnWidth(5, 130);
  sheet.setColumnWidth(6, 90);
  sheet.setColumnWidth(7, 210);
  sheet.setColumnWidths(8, 4, 145);
  sheet.setColumnWidth(12, 330);
  sheet.setColumnWidth(13, 120);
  sheet.getRange(1, 1, sheet.getMaxRows(), width).setVerticalAlignment('middle');

  const existingFilter = sheet.getFilter();
  if (existingFilter) existingFilter.remove();
  sheet.getRange(1, 1, sheet.getMaxRows(), PUBLIC_RESPONSE_COLUMNS).createFilter();
  sheet.showColumns(PUBLIC_RESPONSE_COLUMNS);
  sheet.hideColumns(PUBLIC_RESPONSE_COLUMNS + 1, width - PUBLIC_RESPONSE_COLUMNS);
}

function summaryHeaders_() {
  return [[
    'Day / metric',
    'Economy',
    'Premium Economy',
    'Business',
    'First Class',
    'Total',
  ]];
}

function summaryMetricLabels_() {
  return [
    ['21 Aug · attending parties'],
    ['21 Aug · guest headcount'],
    ['21 Aug · not attending'],
    ['22 Aug · attending parties'],
    ['22 Aug · guest headcount'],
    ['22 Aug · not attending'],
  ];
}

function formatSummaryBlock_(sheet, titleRow, dataRow, title, titleColor) {
  const headerRow = dataRow - 1;
  sheet.getRange(titleRow, 1, 1, 6).merge().setValue(title);
  sheet.getRange(titleRow, 1, 1, 6)
    .setBackground(titleColor)
    .setFontColor('#fff7e8')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange(headerRow, 1, 1, 6).setValues(summaryHeaders_())
    .setBackground('#d7ae62')
    .setFontColor('#122f36')
    .setFontWeight('bold');
  sheet.getRange(dataRow, 1, 6, 1).setValues(summaryMetricLabels_());
  sheet.getRange(dataRow, 1, 6, 6)
    .setBorder(true, true, true, true, true, true, '#c8d8dc', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(dataRow + 1, 1, 1, 6).setBackground('#edf6f7');
  sheet.getRange(dataRow + 4, 1, 1, 6).setBackground('#edf6f7');
  sheet.getRange(dataRow, 2, 6, 5).setHorizontalAlignment('center').setNumberFormat('0');
}

function setSideSummaryFormulas_(sheet, dataRow, invitationSide) {
  for (let column = 2; column <= 5; column += 1) {
    const letter = String.fromCharCode(64 + column);
    const sideCriteria = 'Responses!$M:$M,"' + invitationSide + '",';
    sheet.getRange(dataRow, column).setFormula('=COUNTIFS(' + sideCriteria + 'Responses!$D:$D,' + letter + '$3,Responses!$H:$H,"attending")');
    sheet.getRange(dataRow + 1, column).setFormula('=SUMIFS(Responses!$I:$I,' + sideCriteria + 'Responses!$D:$D,' + letter + '$3,Responses!$H:$H,"attending")');
    sheet.getRange(dataRow + 2, column).setFormula('=COUNTIFS(' + sideCriteria + 'Responses!$D:$D,' + letter + '$3,Responses!$H:$H,"not-attending")');
    sheet.getRange(dataRow + 3, column).setFormula('=COUNTIFS(' + sideCriteria + 'Responses!$D:$D,' + letter + '$3,Responses!$J:$J,"attending")');
    sheet.getRange(dataRow + 4, column).setFormula('=SUMIFS(Responses!$K:$K,' + sideCriteria + 'Responses!$D:$D,' + letter + '$3,Responses!$J:$J,"attending")');
    sheet.getRange(dataRow + 5, column).setFormula('=COUNTIFS(' + sideCriteria + 'Responses!$D:$D,' + letter + '$3,Responses!$J:$J,"not-attending")');
  }
  for (let row = dataRow; row < dataRow + 6; row += 1) {
    sheet.getRange(row, 6).setFormula('=SUM(B' + row + ':E' + row + ')');
  }
}

function setCombinedSummaryFormulas_(sheet, dataRow, groomDataRow, brideDataRow) {
  for (let column = 2; column <= 5; column += 1) {
    const letter = String.fromCharCode(64 + column);
    for (let offset = 0; offset < 6; offset += 1) {
      sheet.getRange(dataRow + offset, column).setFormula(
        '=SUM(' + letter + (groomDataRow + offset) + ',' + letter + (brideDataRow + offset) + ')'
      );
    }
  }
  for (let row = dataRow; row < dataRow + 6; row += 1) {
    sheet.getRange(row, 6).setFormula('=SUM(B' + row + ':E' + row + ')');
  }
}

function formatSummarySheet_(sheet) {
  const groomDataRow = 6;
  const brideDataRow = 15;
  const combinedDataRow = 24;

  sheet.getRange('A1:F32').breakApart();
  sheet.clear();
  sheet.setTabColor('#d7ae62');
  sheet.getRange('A1:F1').merge().setValue('ALEEM & NURULAIN · RSVP SUMMARY');
  sheet.getRange('A1:F1')
    .setBackground('#0a3640')
    .setFontColor('#fff7e8')
    .setFontFamily('Georgia')
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange('A2:F2').merge().setValue('Private response overview · Singapore time');
  sheet.getRange('A2:F2').setFontColor('#557078').setFontStyle('italic').setHorizontalAlignment('center');

  sheet.getRange('B3:E3').setValues([['economy', 'premium-economy', 'business', 'first']]);
  sheet.hideRows(3);

  formatSummaryBlock_(sheet, 4, groomDataRow, 'GROOM INVITATIONS', '#17606a');
  setSideSummaryFormulas_(sheet, groomDataRow, 'groom');
  formatSummaryBlock_(sheet, 13, brideDataRow, 'BRIDE INVITATIONS', '#9b5968');
  setSideSummaryFormulas_(sheet, brideDataRow, 'bride');
  formatSummaryBlock_(sheet, 22, combinedDataRow, 'COMBINED TOTALS', '#0a3640');
  setCombinedSummaryFormulas_(sheet, combinedDataRow, groomDataRow, brideDataRow);

  sheet.getRange('A31').setValue('RSVP deadline');
  sheet.getRange('B31').setValue(new Date('2027-08-08T00:00:00+08:00')).setNumberFormat('dddd, dd mmmm yyyy');
  sheet.getRange('A32').setValue('Latest update');
  sheet.getRange('B32').setFormula('=IF(COUNTA(Responses!$C$2:$C)=0,"",MAX(Responses!$C$2:$C))').setNumberFormat('dd mmm yyyy, hh:mm:ss');
  sheet.getRange('A31:A32').setFontWeight('bold').setFontColor('#34565e');
  sheet.setFrozenRows(5);
  sheet.setColumnWidth(1, 230);
  sheet.setColumnWidths(2, 5, 145);
  sheet.setRowHeight(1, 42);
  sheet.getRange('A1:F32').setVerticalAlignment('middle');
}
