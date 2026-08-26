import { cookies } from 'next/headers';
import { readSession, SESSION_COOKIE } from '../../../../lib/security.server';

export const runtime = 'edge';

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ day: string }> },
) {
  const { day } = await context.params;
  if (day !== 'day21' && day !== 'day22') return new Response('Not found', { status: 404 });

  const cookieStore = await cookies();
  const session = await readSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session || (day === 'day21' && session.scope !== 'both-days')) {
    return new Response('Invitation session required', { status: 401 });
  }

  const event = calendarEvents[day];
  const venue = 'Chengal Ballroom, Crowne Plaza Changi Airport, 75 Airport Boulevard, Singapore 819664';
  const uid = `${day}-aleem-nurulain-2027@our-flight`;
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aleem and Nurulain//Our Flight//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    'DTSTAMP:20260826T000000Z',
    `DTSTART;TZID=Asia/Singapore:${event.start}`,
    `DTEND;TZID=Asia/Singapore:${event.end}`,
    `SUMMARY:${escapeIcs(event.summary)}`,
    `DESCRIPTION:${escapeIcs(event.description)}`,
    `LOCATION:${escapeIcs(venue)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="aleem-nurulain-${day}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

