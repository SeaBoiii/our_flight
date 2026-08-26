/**
 * Bound Google Apps Script for the private Aleem & Nurulain RSVP workbook.
 *
 * The public GitHub Pages app posts a regular HTML form into a hidden iframe.
 * This web app validates the opaque invitation token, writes the response, and
 * returns a tiny HTML page that posts a correlated receipt to the parent page.
 *
 * Required Script Properties:
 *   RSVP_STATUS                       preview | open | closed
 *   PARENT_ORIGIN                     e.g. https://account.github.io
 *   INVITE_TOKEN_HASH_ECONOMY         lowercase SHA-256 hex
 *   INVITE_TOKEN_HASH_PREMIUM         lowercase SHA-256 hex
 *   INVITE_TOKEN_HASH_BUSINESS        lowercase SHA-256 hex
 *   INVITE_TOKEN_HASH_FIRST           lowercase SHA-256 hex
 *
 * setupWorkbook() records SPREADSHEET_ID automatically. Never store raw
 * invitation tokens or the wedding passcode in Script Properties.
 */

const RESPONSES_SHEET = 'Responses';
const SUMMARY_SHEET = 'Summary';
const SPREADSHEET_ID_PROPERTY = 'SPREADSHEET_ID';
const RSVP_STATUS_PROPERTY = 'RSVP_STATUS';
const PARENT_ORIGIN_PROPERTY = 'PARENT_ORIGIN';
const BRIDGE_TYPE = 'our-flight:rsvp-result';
const BRIDGE_VERSION = 1;
const MAX_PAYLOAD_LENGTH = 16384;
const PUBLIC_RESPONSE_COLUMNS = 12;
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
  'Invitation token hash',
  'Payload digest',
];
const INVITATIONS = [
  { cabinClass: 'economy', scope: 'day22', property: 'INVITE_TOKEN_HASH_ECONOMY' },
  { cabinClass: 'premium-economy', scope: 'day22', property: 'INVITE_TOKEN_HASH_PREMIUM' },
  { cabinClass: 'business', scope: 'both-days', property: 'INVITE_TOKEN_HASH_BUSINESS' },
  { cabinClass: 'first', scope: 'both-days', property: 'INVITE_TOKEN_HASH_FIRST' },
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
  configuredInvitations_(properties);
  console.log('Configuration valid. RSVP status: %s. Four invitation classes configured.', status);
  return { ok: true, rsvpStatus: status, invitationClasses: 4 };
}

function doPost(event) {
  let nonce = '';
  let responseId = '';

  try {
    const parameters = event && event.parameter ? event.parameter : {};
    if (String(parameters.bridgeVersion || '') !== String(BRIDGE_VERSION)) {
      throw validationError_('unsupported_bridge', ['bridgeVersion']);
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

    const properties = PropertiesService.getScriptProperties();
    const status = rsvpStatus_(properties);
    if (status !== 'open') throw validationError_(status, []);

    // A valid parent origin is required before accepting writes. postMessage
    // still falls back to "*" for configuration-error receipts only.
    configuredParentOrigin_(properties);
    const invitations = configuredInvitations_(properties);
    const submission = normalizeSubmission_(payload, invitations);

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
      version: BRIDGE_VERSION,
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
      version: BRIDGE_VERSION,
      nonce: nonce,
      responseId: responseId,
      ok: false,
      error: code,
      fields: fields,
    }, PropertiesService.getScriptProperties());
  }
}

function normalizeSubmission_(payload, invitations) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw validationError_('invalid_submission', ['payload']);
  }
  if (payload.version !== BRIDGE_VERSION) {
    throw validationError_('invalid_submission', ['version']);
  }

  if (typeof payload.token !== 'string' || !/^[A-Za-z0-9_-]{20,160}$/.test(payload.token)) {
    throw validationError_('invalid_token', ['token']);
  }
  const token = payload.token;
  const tokenHash = sha256Hex_(token);
  const invitation = invitations.find(function (candidate) {
    return timingSafeEqual_(candidate.tokenHash, tokenHash);
  });
  if (!invitation) throw validationError_('invalid_token', ['token']);

  const responseId = requiredUuid_(payload.responseId, 'responseId');
  const locale = requiredChoice_(payload.locale, ['en', 'ms'], 'locale');
  const inviteeName = requiredText_(payload.inviteeName, 100, 'inviteeName');
  const message = optionalText_(payload.message, 500, 'message');
  const responses = normalizeResponses_(payload.responses, invitation.scope);

  const canonical = {
    version: BRIDGE_VERSION,
    tokenHash: tokenHash,
    responseId: responseId,
    locale: locale,
    inviteeName: inviteeName,
    message: message,
    responses: responses,
  };

  return {
    responseId: responseId,
    cabinClass: invitation.cabinClass,
    scope: invitation.scope,
    locale: locale,
    inviteeName: inviteeName,
    message: message,
    responses: responses,
    tokenHash: tokenHash,
    digest: sha256Hex_(JSON.stringify(canonical)),
  };
}

function normalizeResponses_(value, scope) {
  if (!Array.isArray(value)) throw validationError_('invalid_submission', ['responses']);

  const expectedIds = scope === 'both-days' ? ['day21', 'day22'] : ['day22'];
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
    const sameToken = timingSafeEqual_(String(metadata[0] || '').toLowerCase(), submission.tokenHash);
    const samePayload = timingSafeEqual_(String(metadata[1] || '').toLowerCase(), submission.digest);
    if (!sameToken || !samePayload) throw validationError_('idempotency_conflict', ['responseId']);
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
    submission.tokenHash,
    submission.digest,
  ];
  sheet.appendRow(row);
  return { duplicate: false };
}

function configuredInvitations_(properties) {
  const seen = {};
  return INVITATIONS.map(function (invitation) {
    const tokenHash = String(properties.getProperty(invitation.property) || '').trim().toLowerCase();
    if (!isSha256_(tokenHash) || seen[tokenHash]) throw validationError_('not_configured', []);
    seen[tokenHash] = true;
    return {
      cabinClass: invitation.cabinClass,
      scope: invitation.scope,
      tokenHash: tokenHash,
    };
  });
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
    + '<body><script>window.parent.postMessage(' + safeReceipt + ',' + targetOrigin + ');<\/script></body></html>';
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

function formatResponsesSheet_(sheet) {
  const width = RESPONSE_HEADERS.length;
  if (sheet.getMaxColumns() < width) sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
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
  sheet.getRange(1, 1, sheet.getMaxRows(), width).setVerticalAlignment('middle');

  const existingFilter = sheet.getFilter();
  if (existingFilter) existingFilter.remove();
  sheet.getRange(1, 1, sheet.getMaxRows(), PUBLIC_RESPONSE_COLUMNS).createFilter();
  sheet.hideColumns(PUBLIC_RESPONSE_COLUMNS + 1, width - PUBLIC_RESPONSE_COLUMNS);
}

function formatSummarySheet_(sheet) {
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
  sheet.getRange('A4:F4').setValues([[
    'Day / metric',
    'Economy',
    'Premium Economy',
    'Business',
    'First Class',
    'Total',
  ]]);
  sheet.getRange('A5:A10').setValues([
    ['21 Aug · attending parties'],
    ['21 Aug · guest headcount'],
    ['21 Aug · not attending'],
    ['22 Aug · attending parties'],
    ['22 Aug · guest headcount'],
    ['22 Aug · not attending'],
  ]);

  for (let column = 2; column <= 5; column += 1) {
    const letter = String.fromCharCode(64 + column);
    sheet.getRange(5, column).setFormula('=COUNTIFS(Responses!$D:$D,' + letter + '$3,Responses!$H:$H,"attending")');
    sheet.getRange(6, column).setFormula('=SUMIFS(Responses!$I:$I,Responses!$D:$D,' + letter + '$3,Responses!$H:$H,"attending")');
    sheet.getRange(7, column).setFormula('=COUNTIFS(Responses!$D:$D,' + letter + '$3,Responses!$H:$H,"not-attending")');
    sheet.getRange(8, column).setFormula('=COUNTIFS(Responses!$D:$D,' + letter + '$3,Responses!$J:$J,"attending")');
    sheet.getRange(9, column).setFormula('=SUMIFS(Responses!$K:$K,Responses!$D:$D,' + letter + '$3,Responses!$J:$J,"attending")');
    sheet.getRange(10, column).setFormula('=COUNTIFS(Responses!$D:$D,' + letter + '$3,Responses!$J:$J,"not-attending")');
  }
  for (let row = 5; row <= 10; row += 1) sheet.getRange(row, 6).setFormula('=SUM(B' + row + ':E' + row + ')');

  sheet.getRange('A4:F4').setBackground('#d7ae62').setFontColor('#122f36').setFontWeight('bold');
  sheet.getRange('A5:F10').setBorder(true, true, true, true, true, true, '#c8d8dc', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange('A6:F6').setBackground('#edf6f7');
  sheet.getRange('A9:F9').setBackground('#edf6f7');
  sheet.getRange('B5:F10').setHorizontalAlignment('center').setNumberFormat('0');
  sheet.getRange('A12').setValue('RSVP deadline');
  sheet.getRange('B12').setValue(new Date('2027-08-08T00:00:00+08:00')).setNumberFormat('dddd, dd mmmm yyyy');
  sheet.getRange('A13').setValue('Latest update');
  sheet.getRange('B13').setFormula('=IF(COUNTA(Responses!$C$2:$C)=0,"",MAX(Responses!$C$2:$C))').setNumberFormat('dd mmm yyyy, hh:mm:ss');
  sheet.getRange('A12:A13').setFontWeight('bold').setFontColor('#34565e');
  sheet.setFrozenRows(4);
  sheet.setColumnWidth(1, 230);
  sheet.setColumnWidths(2, 5, 145);
  sheet.setRowHeight(1, 42);
  sheet.getRange('A1:F13').setVerticalAlignment('middle');
}
