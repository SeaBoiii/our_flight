import { describe, expect, it, vi } from 'vitest';
import { isGoogleBridgeOrigin, isTrustedBridgeReceipt, submitRsvp } from '../api';

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
