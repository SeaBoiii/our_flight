import {
  corsHeaders,
  isAllowedFrontendOrigin,
  jsonResponse,
  preflightResponse,
  unauthorizedOriginResponse,
} from '../../../../../lib/api.server';
import { accessTokenIsConfigured, authenticateRequest } from '../../../../../lib/security.server';

export const runtime = 'edge';
const METHODS = 'GET, OPTIONS';

const calendarEvents = {
  day21: {
    summary: "Aleem & Nurulain — Nikah & Bride's Reception",
    start: '20270821T100000',
    end: '20270821T160000',
    description: "Nikah: 10:00–12:00. Bride's Reception: 12:00–16:00.",
  },
  day22: {
    summary: 'Aleem & Nurulain — Walimatul Urus',
    start: '20270822T120000',
    end: '20270822T160000',
    description: 'Walimatul Urus: 12:00–16:00.',
  },
} as const;

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const characterBytes = encoder.encode(character).length;
    if (current && bytes + characterBytes > 75) {
      parts.push(current);
      current = ` ${character}`;
      bytes = 1 + characterBytes;
    } else {
      current += character;
      bytes += characterBytes;
    }
  }
  if (current) parts.push(current);
  return parts.join('\r\n');
}

export function OPTIONS(request: Request) {
  return preflightResponse(request, METHODS);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ day: string }> },
) {
  if (!isAllowedFrontendOrigin(request)) return unauthorizedOriginResponse(request, METHODS);
  if (!accessTokenIsConfigured()) {
    return jsonResponse(request, { error: 'service_unavailable' }, 503, METHODS);
  }
  const session = await authenticateRequest(request);
  if (!session) return jsonResponse(request, { error: 'session_required' }, 401, METHODS);

  const { day } = await context.params;
  if (day !== 'day21' && day !== 'day22') {
    return jsonResponse(request, { error: 'not_found' }, 404, METHODS);
  }
  if (day === 'day21' && session.scope !== 'both-days') {
    return jsonResponse(request, { error: 'not_found' }, 404, METHODS);
  }

  const event = calendarEvents[day];
  const location = 'Chengal Ballroom, Crowne Plaza Changi Airport, 75 Airport Boulevard, Singapore 819664';
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aleem and Nurulain//Our Flight//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${day}-aleem-nurulain-2027@our-flight`,
    'DTSTAMP:20260826T000000Z',
    `DTSTART;TZID=Asia/Singapore:${event.start}`,
    `DTEND;TZID=Asia/Singapore:${event.end}`,
    `SUMMARY:${escapeIcs(event.summary)}`,
    `DESCRIPTION:${escapeIcs(event.description)}`,
    `LOCATION:${escapeIcs(location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].map(foldIcsLine).join('\r\n');

  const headers = corsHeaders(request, METHODS);
  headers.set('Content-Type', 'text/calendar; charset=utf-8');
  headers.set('Content-Disposition', `attachment; filename="aleem-nurulain-${day}.ics"`);
  headers.set('Access-Control-Expose-Headers', 'Content-Disposition');
  headers.set('Cache-Control', 'private, no-store');
  return new Response(body, { status: 200, headers });
}
