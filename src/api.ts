import type { Invitation, Locale, RsvpDraft } from './types';

type UnlockResponse = { invitation: Invitation; accessToken: string; expiresAt: string };
type InvitationResponse = { invitation: Invitation; expiresAt: string };

export class ApiFailure extends Error {
  status: number;
  code: string;
  fields: string[];

  constructor(status: number, code: string, fields: string[] = []) {
    super(code);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function apiOrigin(): string {
  const configured = import.meta.env.VITE_API_ORIGIN as string | undefined;
  if (configured) return configured.replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://localhost:3000';
  throw new Error('VITE_API_ORIGIN is required for production builds');
}

async function request(path: string, init: RequestInit, accessToken?: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  try {
    return await fetch(`${apiOrigin()}${path}`, {
      ...init,
      headers,
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as { error?: string; fields?: string[] };
  if (!response.ok) throw new ApiFailure(response.status, body.error ?? 'request_failed', body.fields ?? []);
  return body as T;
}

export async function unlockInvitation(token: string, passcode: string): Promise<UnlockResponse> {
  const response = await request('/api/v1/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, passcode }),
  });
  return json<UnlockResponse>(response);
}

export async function restoreInvitation(accessToken: string): Promise<InvitationResponse> {
  const response = await request('/api/v1/invitation', { method: 'GET' }, accessToken);
  return json<InvitationResponse>(response);
}

export async function submitRsvp(
  accessToken: string,
  locale: Locale,
  draft: RsvpDraft,
): Promise<{ ok: true; duplicate: boolean }> {
  const response = await request('/api/v1/rsvp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      responseId: draft.responseId,
      locale,
      inviteeName: draft.inviteeName,
      message: draft.message || undefined,
      responses: draft.responses.map((answer) => ({
        eventId: answer.eventId,
        attendance: answer.attendance,
        partySize: answer.attendance === 'attending' ? Number(answer.partySize) : undefined,
      })),
    }),
  }, accessToken);
  return json<{ ok: true; duplicate: boolean }>(response);
}

export async function downloadCalendar(accessToken: string, path: string): Promise<void> {
  const response = await request(path, { method: 'GET' }, accessToken);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new ApiFailure(response.status, body.error ?? 'calendar_failed');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'aleem-nurulain-event.ics';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
