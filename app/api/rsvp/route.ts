import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isAllowedOrigin, readSession, SESSION_COOKIE } from '../../../lib/security.server';
import type {
  Attendance,
  EventRsvp,
  Locale,
  RsvpSubmissionInput,
  StoredRsvpSubmission,
} from '../../../lib/types';

export const runtime = 'edge';

type ValidationResult =
  | { ok: true; value: RsvpSubmissionInput }
  | { ok: false; fields: string[] };

function parseEventRsvp(value: unknown, field: string, errors: string[]): EventRsvp | null {
  if (!value || typeof value !== 'object') {
    errors.push(field);
    return null;
  }
  const raw = value as { attendance?: unknown; partySize?: unknown };
  const attendance = raw.attendance as Attendance;
  if (attendance !== 'attending' && attendance !== 'not-attending') {
    errors.push(field);
    return null;
  }
  if (attendance === 'attending') {
    if (typeof raw.partySize !== 'number') {
      errors.push(`${field}.partySize`);
      return null;
    }
    const partySize = raw.partySize;
    if (!Number.isSafeInteger(partySize) || partySize < 1) {
      errors.push(`${field}.partySize`);
      return null;
    }
    return { attendance, partySize };
  }
  return { attendance };
}

function validateInput(value: unknown, bothDays: boolean): ValidationResult {
  if (!value || typeof value !== 'object') return { ok: false, fields: ['form'] };
  const body = value as Record<string, unknown>;
  const errors: string[] = [];
  const responseId = typeof body.responseId === 'string' ? body.responseId.trim() : '';
  const locale = body.locale as Locale;
  const inviteeName = typeof body.inviteeName === 'string' ? body.inviteeName.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(responseId)) {
    errors.push('responseId');
  }
  if (locale !== 'en' && locale !== 'ms') errors.push('locale');
  if (!inviteeName || inviteeName.length > 100) errors.push('inviteeName');
  if (message.length > 500) errors.push('message');

  const day22 = parseEventRsvp(body.day22, 'day22', errors);
  const day21 = bothDays ? parseEventRsvp(body.day21, 'day21', errors) : null;
  if (!bothDays && body.day21 !== undefined) errors.push('day21');

  if (errors.length || !day22 || (bothDays && !day21)) return { ok: false, fields: errors };
  return {
    ok: true,
    value: {
      responseId,
      locale,
      inviteeName,
      day21: day21 ?? undefined,
      day22,
      message: message || undefined,
    },
  };
}

async function forwardToSheet(submission: StoredRsvpSubmission) {
  const endpoint = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SHARED_SECRET;
  if (!endpoint || !secret) {
    if (process.env.RSVP_DEMO_MODE === 'true') return { ok: true, demo: true };
    throw new Error('RSVP destination is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret, submission }),
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('RSVP destination rejected the request');
    const result = (await response.json()) as { ok?: boolean; duplicate?: boolean };
    if (!result.ok) throw new Error('RSVP destination did not confirm the write');
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 403 });
  }

  const cookieStore = await cookies();
  const session = await readSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: 'session_expired' }, { status: 401 });

  let body: unknown;
  try {
    const declaredLength = Number(request.headers.get('content-length') ?? 0);
    if (declaredLength > 16_384) {
      return NextResponse.json({ error: 'request_too_large' }, { status: 413 });
    }
    const rawBody = await request.text();
    if (rawBody.length > 16_384) {
      return NextResponse.json({ error: 'request_too_large' }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const parsed = validateInput(body, session.scope === 'both-days');
  if (!parsed.ok) {
    return NextResponse.json(
      { error: 'validation_failed', fields: parsed.fields },
      { status: 422 },
    );
  }

  const submission: StoredRsvpSubmission = {
    ...parsed.value,
    cabinClass: session.cabinClass,
    scope: session.scope,
    submittedAt: new Date().toISOString(),
  };

  try {
    const result = await forwardToSheet(submission);
    const response = NextResponse.json({ ok: true, duplicate: Boolean(result.duplicate) });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return NextResponse.json({ error: 'destination_unavailable' }, { status: 503 });
  }
}
