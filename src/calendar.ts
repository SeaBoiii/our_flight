import type { InvitationEvent, Locale } from './types';
import { localized } from './types';

const venue = 'Chengal Ballroom, Crowne Plaza Changi Airport, 75 Airport Boulevard, Singapore 819664';

function escapeIcs(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;');
}

function foldLine(line: string): string[] {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  for (const character of line) {
    const candidate = current + character;
    const limit = parts.length ? 74 : 75;
    if (encoder.encode(candidate).length > limit) {
      parts.push(current);
      current = ` ${character}`;
    } else {
      current = candidate;
    }
  }
  parts.push(current);
  return parts;
}

function eventLines(event: InvitationEvent, locale: Locale): string[] {
  return event.calendarSegments.flatMap((segment, index) => [
    'BEGIN:VEVENT',
    // The reception is the same event in both 21 August invitation scopes.
    // Keep previously published full-programme and 22 August UIDs stable.
    `UID:${event.flightCode.toLowerCase()}-${index + (event.calendarKey === 'day21-reception' ? 2 : 1)}@aleem-nurulain`,
    'DTSTAMP:20260826T000000Z',
    `DTSTART;TZID=Asia/Singapore:${segment.startLocal}`,
    `DTEND;TZID=Asia/Singapore:${segment.endLocal}`,
    `SUMMARY:${escapeIcs(`Aleem & Nurulain · ${localized(segment.title, locale)}`)}`,
    `LOCATION:${escapeIcs(venue)}`,
    `DESCRIPTION:${escapeIcs(`${localized(event.title, locale)} · Wedding keepsake, not valid for travel.`)}`,
    'END:VEVENT',
  ]);
}

export function calendarContents(event: InvitationEvent, locale: Locale): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aleem and Nurulain//Our Flight//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Singapore',
    'X-LIC-LOCATION:Asia/Singapore',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:SGT',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...eventLines(event, locale),
    'END:VCALENDAR',
  ];
  return `${lines.flatMap(foldLine).join('\r\n')}\r\n`;
}

export function calendarFileName(event: Pick<InvitationEvent, 'calendarKey'>, locale: Locale): string {
  return `aleem-nurulain-${event.calendarKey}-${locale}.ics`;
}

export function calendarUrl(event: Pick<InvitationEvent, 'calendarKey'>, locale: Locale, base = '/'): string {
  return `${base.replace(/\/?$/, '/')}calendar/${calendarFileName(event, locale)}`;
}
