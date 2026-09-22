import { afterEach, describe, expect, it, vi } from 'vitest';
import { isGoogleBridgeOrigin, isTrustedBridgeReceipt, submitRsvp } from '../api';
import type { RsvpDraft } from '../types';

const requestSubmitDescriptor = Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, 'requestSubmit')!;
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(HTMLFormElement.prototype, 'requestSubmit', requestSubmitDescriptor);
});

const draft: RsvpDraft = {
  responseId: '123e4567-e89b-42d3-a456-426614174000', inviteeName: 'Guest', message: '',
  responses: [{ eventId: 'day22', attendance: 'attending', partySize: '2' }],
};

describe('RSVP submission cleanup', () => {
  it('removes the private submission form and receipt listener when submission throws', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/example-deployment/exec');
    vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(() => { throw new Error('Blocked'); });
    const removeListener = vi.spyOn(window, 'removeEventListener');
    await expect(submitRsvp({ kind: 'class-code', value: 'ALPHA123' }, 'en', draft))
      .rejects.toMatchObject({ code: 'submission_failed' });
    expect(document.querySelector('form[target^="our-flight-rsvp-"]')).toBeNull();
    expect(document.querySelector('iframe[name^="our-flight-rsvp-"]')).toBeNull();
    expect(removeListener).toHaveBeenCalledWith('message', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up an aborted visit while retaining its response ID for safe retries', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/example-deployment/exec');
    vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(() => {});
    const controller = new AbortController();
    const pending = submitRsvp({ kind: 'class-code', value: 'ALPHA123' }, 'en', draft, controller.signal);
    const outcome = expect(pending).rejects.toMatchObject({ code: 'unconfirmed' });
    controller.abort();
    await outcome;
    expect(document.querySelector('input[name="payload"]')).toBeNull();
    expect(document.querySelector('iframe[name^="our-flight-rsvp-"]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(draft.responseId).toBe('123e4567-e89b-42d3-a456-426614174000');
  });

  it('times out without confirmation and removes the private transport', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/example-deployment/exec');
    vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(() => {});
    const outcome = expect(submitRsvp({ kind: 'class-code', value: 'ALPHA123' }, 'en', draft))
      .rejects.toMatchObject({ code: 'unconfirmed' });
    await vi.advanceTimersByTimeAsync(30_000);
    await outcome;
    expect(document.querySelector('input[name="payload"]')).toBeNull();
    expect(document.querySelector('iframe[name^="our-flight-rsvp-"]')).toBeNull();
  });

  it('uses native form submission when requestSubmit is unavailable', async () => {
    vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/example-deployment/exec');
    Object.defineProperty(HTMLFormElement.prototype, 'requestSubmit', { configurable: true, value: undefined });
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function submit(this: HTMLFormElement) {
      const nonce = (this.elements.namedItem('nonce') as HTMLInputElement).value;
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://script.googleusercontent.com',
        data: { type: 'our-flight:rsvp-result', version: 2, nonce, responseId: draft.responseId, ok: true },
      }));
    });
    await expect(submitRsvp({ kind: 'class-code', value: 'ALPHA123' }, 'en', draft))
      .resolves.toEqual({ ok: true, duplicate: false });
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe('Apps Script response bridge origins', () => {
  it('accepts only HTTPS Google script response origins', () => {
    expect(isGoogleBridgeOrigin('https://script.google.com')).toBe(true);
    expect(isGoogleBridgeOrigin('https://script.googleusercontent.com')).toBe(true);
    expect(isGoogleBridgeOrigin('https://example.googleusercontent.com')).toBe(true);
    expect(isGoogleBridgeOrigin('http://script.google.com')).toBe(false);
    expect(isGoogleBridgeOrigin('https://script.google.com.example.test')).toBe(false);
    expect(isGoogleBridgeOrigin('null')).toBe(false);
  });

  it('accepts only a Google receipt correlated to both submission identifiers', () => {
    const receipt = {
      type: 'our-flight:rsvp-result',
      version: 2,
      nonce: 'receipt-nonce',
      responseId: 'response-id',
      ok: true,
      duplicate: false,
    };

    expect(isTrustedBridgeReceipt(
      'https://n-example-script.googleusercontent.com',
      receipt,
      'receipt-nonce',
      'response-id',
    )).toBe(true);
    expect(isTrustedBridgeReceipt(
      'https://n-example-script.googleusercontent.com',
      receipt,
      'different-nonce',
      'response-id',
    )).toBe(false);
    expect(isTrustedBridgeReceipt(
      'https://n-example-script.googleusercontent.com',
      { ...receipt, version: 1 },
      'receipt-nonce',
      'response-id',
    )).toBe(false);
    expect(isTrustedBridgeReceipt(
      'https://evil.example',
      receipt,
      'receipt-nonce',
      'response-id',
    )).toBe(false);
    expect(isTrustedBridgeReceipt(
      'https://n-example-script.googleusercontent.com',
      { ...receipt, duplicate: 'false' },
      'receipt-nonce',
      'response-id',
    )).toBe(false);
    expect(isTrustedBridgeReceipt(
      'https://n-example-script.googleusercontent.com',
      { ...receipt, ok: false, error: 42 },
      'receipt-nonce',
      'response-id',
    )).toBe(false);
  });

  it('submits the version-2 access-credential contract and confirms its correlated receipt', async () => {
    vi.stubEnv('VITE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/example-deployment/exec');
    let submittedPayload: Record<string, unknown> | null = null;
    vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(function requestSubmit(this: HTMLFormElement) {
      const payloadField = this.elements.namedItem('payload') as HTMLInputElement;
      const nonceField = this.elements.namedItem('nonce') as HTMLInputElement;
      submittedPayload = JSON.parse(payloadField.value);
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://n-example-script.googleusercontent.com',
        data: {
          type: 'our-flight:rsvp-result',
          version: 2,
          nonce: nonceField.value,
          responseId: '123e4567-e89b-42d3-a456-426614174000',
          ok: true,
          duplicate: false,
        },
      }));
    });

    await expect(submitRsvp(
      { kind: 'class-code', value: 'ALPHA123' },
      'en',
      {
        responseId: '123e4567-e89b-42d3-a456-426614174000',
        inviteeName: 'Guest',
        message: '',
        responses: [{ eventId: 'day22', attendance: 'attending', partySize: '2' }],
      },
    )).resolves.toEqual({ ok: true, duplicate: false });

    expect(submittedPayload).toMatchObject({
      version: 2,
      credential: { kind: 'class-code', value: 'ALPHA123' },
      responses: [{ eventId: 'day22', attendance: 'attending', partySize: 2 }],
    });
    expect(submittedPayload).not.toHaveProperty('side');
    expect(submittedPayload).not.toHaveProperty('scope');
  });
});
