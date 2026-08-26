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
    `UID:${event.flightCode.toLowerCase()}-${index + 1}@aleem-nurulain`,
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

export function downloadCalendar(event: InvitationEvent, locale: Locale): void {
  const blob = new Blob([calendarContents(event, locale)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aleem-nurulain-${event.dateIso}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
