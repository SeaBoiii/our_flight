import { describe, expect, it } from 'vitest';
import { isGoogleBridgeOrigin, isTrustedBridgeReceipt } from '../api';

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
      version: 1,
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
      'https://evil.example',
      receipt,
      'receipt-nonce',
      'response-id',
    )).toBe(false);
  });
});
