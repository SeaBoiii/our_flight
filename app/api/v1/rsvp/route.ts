import {
  isAllowedFrontendOrigin,
  hasJsonContentType,
  jsonResponse,
  preflightResponse,
  unauthorizedOriginResponse,
} from '../../../../lib/api.server';
import { getInvitation } from '../../../../lib/invitation.server';
import { accessTokenIsConfigured, authenticateRequest } from '../../../../lib/security.server';
import type {
  Attendance,
  EventRsvp,
  Locale,
  RsvpSubmissionInput,
  StoredRsvpSubmission,
} from '../../../../lib/types';

export const runtime = 'edge';
const METHODS = 'POST, OPTIONS';

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
    if (typeof raw.partySize !== 'number' || !Number.isSafeInteger(raw.partySize) || raw.partySize < 1) {
      errors.push(`${field}.partySize`);
      return null;
    }
    return { attendance, partySize: raw.partySize };
  }
  if (raw.partySize !== undefined) {
    errors.push(`${field}.partySize`);
    return null;
  }
  return { attendance };
}

function validateInput(value: unknown, expectedEventIds: Array<'day21' | 'day22'>): ValidationResult {
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
  if (body.message !== undefined && typeof body.message !== 'string') errors.push('message');
  if (message.length > 500) errors.push('message');
  if (!Array.isArray(body.responses)) errors.push('responses');

  const answers = new Map<string, EventRsvp>();
  if (Array.isArray(body.responses)) {
    for (const rawAnswer of body.responses) {
      if (!rawAnswer || typeof rawAnswer !== 'object') {
        errors.push('responses');
        continue;
      }
      const answer = rawAnswer as { eventId?: unknown };
      const eventId = typeof answer.eventId === 'string' ? answer.eventId : '';
      if (!expectedEventIds.includes(eventId as 'day21' | 'day22') || answers.has(eventId)) {
        errors.push(`responses.${eventId || 'event'}`);
        continue;
      }
      const parsed = parseEventRsvp(answer, `responses.${eventId}`, errors);
      if (parsed) answers.set(eventId, parsed);
    }
  }
  for (const eventId of expectedEventIds) {
    if (!answers.has(eventId)) errors.push(`responses.${eventId}`);
  }
  if (answers.size !== expectedEventIds.length) errors.push('responses');

  const day22 = answers.get('day22');
  const day21 = answers.get('day21');
  if (errors.length || !day22) return { ok: false, fields: [...new Set(errors)] };
  return {
    ok: true,
    value: {
      responseId,
      locale,
      inviteeName,
      day21,
      day22,
      message: message || undefined,
    },
  };
}

async function forwardToSheet(submission: StoredRsvpSubmission) {
  const endpoint = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SHARED_SECRET;
  if (!endpoint || !secret) throw new Error('RSVP destination is not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
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

export function OPTIONS(request: Request) {
  return preflightResponse(request, METHODS);
}

export async function POST(request: Request) {
  if (!isAllowedFrontendOrigin(request)) return unauthorizedOriginResponse(request, METHODS);
  if (!accessTokenIsConfigured()) {
    return jsonResponse(request, { error: 'service_unavailable' }, 503, METHODS);
  }
  if (!hasJsonContentType(request)) {
    return jsonResponse(request, { error: 'unsupported_media_type' }, 415, METHODS);
  }
  const session = await authenticateRequest(request);
  if (!session) return jsonResponse(request, { error: 'session_expired' }, 401, METHODS);

  const invitation = getInvitation(session.cabinClass);
  if (invitation.rsvpStatus === 'preview') {
    return jsonResponse(request, { error: 'rsvp_not_open' }, 409, METHODS);
  }
  if (invitation.rsvpStatus === 'closed') {
    return jsonResponse(request, { error: 'rsvp_closed' }, 410, METHODS);
  }

  let body: unknown;
  try {
    const declaredLength = Number(request.headers.get('content-length') ?? 0);
    if (declaredLength > 16_384) {
      return jsonResponse(request, { error: 'request_too_large' }, 413, METHODS);
    }
    const rawBody = await request.text();
    if (rawBody.length > 16_384) {
      return jsonResponse(request, { error: 'request_too_large' }, 413, METHODS);
    }
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse(request, { error: 'invalid_request' }, 400, METHODS);
  }

  const expectedIds = invitation.events.map((event) => event.id);
  const parsed = validateInput(body, expectedIds);
  if (!parsed.ok) {
    return jsonResponse(
      request,
      { error: 'validation_failed', fields: parsed.fields },
      422,
      METHODS,
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
    return jsonResponse(request, { ok: true, duplicate: Boolean(result.duplicate) }, 200, METHODS);
  } catch {
    return jsonResponse(request, { error: 'destination_unavailable' }, 503, METHODS);
  }
}
