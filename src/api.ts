import { appsScriptUrl } from './invitations';
import type { AccessCredential, Locale, RsvpDraft, RsvpReceipt } from './types';

const BRIDGE_VERSION = 2;

type BridgeMessage = RsvpReceipt & {
  type: 'our-flight:rsvp-result';
  version: 2;
  nonce: string;
  responseId: string;
};

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

export function isGoogleBridgeOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && (
      url.hostname === 'script.google.com'
      || url.hostname === 'script.googleusercontent.com'
      || url.hostname.endsWith('.googleusercontent.com')
    );
  } catch {
    return false;
  }
}

function isBridgeMessage(value: unknown, nonce: string, responseId: string): value is BridgeMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<BridgeMessage>;
  const baseValid = message.type === 'our-flight:rsvp-result'
    && message.version === BRIDGE_VERSION
    && message.nonce === nonce
    && message.responseId === responseId
    && typeof message.ok === 'boolean'
    && (message.fields === undefined || (
      Array.isArray(message.fields)
      && message.fields.every((field) => typeof field === 'string')
    ));
  if (!baseValid) return false;
  if (message.ok) return message.duplicate === undefined || typeof message.duplicate === 'boolean';
  return typeof message.error === 'string';
}

export function isTrustedBridgeReceipt(
  origin: string,
  value: unknown,
  nonce: string,
  responseId: string,
): boolean {
  return isGoogleBridgeOrigin(origin) && isBridgeMessage(value, nonce, responseId);
}

export async function submitRsvp(
  accessCredential: AccessCredential,
  locale: Locale,
  draft: RsvpDraft,
): Promise<{ ok: true; duplicate: boolean }> {
  const endpoint = appsScriptUrl();
  if (!endpoint) throw new ApiFailure(503, 'not_configured');

  const nonce = crypto.randomUUID();
  const frameName = `our-flight-rsvp-${nonce}`;
  const iframe = document.createElement('iframe');
  iframe.name = frameName;
  iframe.title = 'RSVP submission response';
  iframe.hidden = true;
  // `allow-same-origin` preserves the Google response origin so the receipt can
  // be authenticated. The response is still isolated in its own cross-origin frame.
  iframe.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin');

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = endpoint;
  form.target = frameName;
  form.enctype = 'application/x-www-form-urlencoded';
  form.hidden = true;

  const bridgeVersion = document.createElement('input');
  bridgeVersion.type = 'hidden';
  bridgeVersion.name = 'bridgeVersion';
  bridgeVersion.value = String(BRIDGE_VERSION);

  const nonceField = document.createElement('input');
  nonceField.type = 'hidden';
  nonceField.name = 'nonce';
  nonceField.value = nonce;

  const payloadField = document.createElement('input');
  payloadField.type = 'hidden';
  payloadField.name = 'payload';
  payloadField.value = JSON.stringify({
    version: BRIDGE_VERSION,
    credential: accessCredential,
    responseId: draft.responseId,
    locale,
    inviteeName: draft.inviteeName,
    message: draft.message || undefined,
    responses: draft.responses.map((answer) => ({
      eventId: answer.eventId,
      attendance: answer.attendance,
      partySize: answer.attendance === 'attending' ? Number(answer.partySize) : undefined,
    })),
  });

  form.append(bridgeVersion, nonceField, payloadField);
  document.body.append(iframe, form);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timeout);
      form.remove();
      iframe.remove();
    };

    const onMessage = (event: MessageEvent) => {
      // Apps Script HtmlService nests the receipt document inside a Google
      // wrapper frame, so its WindowProxy is not the form target's WindowProxy.
      // Authenticate the receipt with its Google origin and two correlated IDs.
      if (!isTrustedBridgeReceipt(event.origin, event.data, nonce, draft.responseId)) return;
      cleanup();
      if (!event.data.ok) {
        const status = event.data.error === 'closed' ? 410 : event.data.error === 'preview' ? 409 : 422;
        reject(new ApiFailure(status, event.data.error ?? 'submission_rejected', event.data.fields ?? []));
        return;
      }
      resolve({ ok: true, duplicate: Boolean(event.data.duplicate) });
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new ApiFailure(0, 'unconfirmed'));
    }, 30_000);

    window.addEventListener('message', onMessage);
    form.requestSubmit();
  });
}
