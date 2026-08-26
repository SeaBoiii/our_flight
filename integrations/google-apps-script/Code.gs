/**
 * Bound Google Apps Script for the private Aleem & Nurulain RSVP workbook.
 * Run setupWorkbook() once, set the INGEST_SECRET Script Property, then deploy
 * doPost as a web app that executes as the workbook owner.
 */

const RESPONSES_SHEET = 'Responses';
const SUMMARY_SHEET = 'Summary';
const INGEST_SECRET_PROPERTY = 'INGEST_SECRET';
const SPREADSHEET_ID_PROPERTY = 'SPREADSHEET_ID';
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
];

function setupWorkbook() {
  const workbook = SpreadsheetApp.getActiveSpreadsheet();
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

function doPost(event) {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty(INGEST_SECRET_PROPERTY);
    if (!secret) return json_({ ok: false, error: 'not_configured' });

    const rawPayload = (event && event.postData && event.postData.contents) || '{}';
    if (rawPayload.length > 16384) return json_({ ok: false, error: 'request_too_large' });
    const payload = JSON.parse(rawPayload);
    if (!payload || payload.secret !== secret) return json_({ ok: false, error: 'unauthorized' });

    const record = normalizeSubmission_(payload.submission);
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return json_({ ok: false, error: 'busy' });

    try {
      const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY);
      if (!spreadsheetId) throw new Error('Spreadsheet ID is missing. Run setupWorkbook() first.');
      const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(RESPONSES_SHEET);
      if (!sheet) throw new Error('Responses sheet is missing. Run setupWorkbook() first.');

      const existingRow = findResponseRow_(sheet, record[0]);
      const now = new Date();
      let duplicate = false;

      if (existingRow) {
        duplicate = true;
        const originalSubmittedAt = sheet.getRange(existingRow, 2).getValue();
        record[1] = originalSubmittedAt || record[1];
        record[2] = now;
        sheet.getRange(existingRow, 1, 1, RESPONSE_HEADERS.length).setValues([record]);
      } else {
        record[2] = now;
        sheet.appendRow(record);
      }

      return json_({ ok: true, duplicate: duplicate });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: 'invalid_submission' });
  }
}

function normalizeSubmission_(submission) {
  if (!submission || typeof submission !== 'object') throw new Error('Missing submission');

  const cabinClasses = ['economy', 'premium-economy', 'business', 'first'];
  const scopes = ['day22', 'both-days'];
  const responseId = requiredText_(submission.responseId, 80, 'responseId');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(responseId)) {
    throw new Error('Invalid responseId');
  }
  const cabinClass = requiredChoice_(submission.cabinClass, cabinClasses, 'cabinClass');
  const scope = requiredChoice_(submission.scope, scopes, 'scope');
  const expectedScope = cabinClass === 'business' || cabinClass === 'first' ? 'both-days' : 'day22';
  if (scope !== expectedScope) throw new Error('Cabin class and invitation scope do not match');

  const language = requiredChoice_(submission.locale, ['en', 'ms'], 'locale');
  const inviteeName = safeSheetText_(requiredText_(submission.inviteeName, 100, 'inviteeName'));
  const message = submission.message == null ? '' : safeSheetText_(requiredText_(submission.message, 500, 'message'));
  const day21 = scope === 'both-days' ? normalizeEvent_(submission.day21, 'day21') : { attendance: '', partySize: '' };
  if (scope === 'day22' && submission.day21 != null) throw new Error('21 August response is not allowed');
  const day22 = normalizeEvent_(submission.day22, 'day22');
  const submittedAt = new Date(submission.submittedAt);
  if (Number.isNaN(submittedAt.getTime())) throw new Error('Invalid submittedAt');

  return [
    safeSheetText_(responseId),
    submittedAt,
    new Date(),
    cabinClass,
    scope,
    language,
    inviteeName,
    day21.attendance,
    day21.partySize,
    day22.attendance,
    day22.partySize,
    message,
  ];
}

function normalizeEvent_(value, field) {
  if (!value || typeof value !== 'object') throw new Error('Missing ' + field);
  const attendance = requiredChoice_(value.attendance, ['attending', 'not-attending'], field + '.attendance');
  if (attendance === 'not-attending') return { attendance: attendance, partySize: '' };
  if (typeof value.partySize !== 'number') throw new Error('Invalid ' + field + '.partySize');
  const partySize = value.partySize;
  if (!Number.isSafeInteger(partySize) || partySize < 1) throw new Error('Invalid ' + field + '.partySize');
  return { attendance: attendance, partySize: partySize };
}

function requiredText_(value, maxLength, field) {
  if (typeof value !== 'string') throw new Error('Invalid ' + field);
  const result = value.trim();
  if (!result || result.length > maxLength) throw new Error('Invalid ' + field);
  return result;
}

function requiredChoice_(value, choices, field) {
  if (choices.indexOf(value) === -1) throw new Error('Invalid ' + field);
  return value;
}

function safeSheetText_(value) {
  const text = String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
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
  sheet.getRange(1, 1, sheet.getMaxRows(), width).createFilter();
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

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
