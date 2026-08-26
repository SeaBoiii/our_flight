import { describe, expect, it } from 'vitest';
import { isGoogleBridgeOrigin } from '../api';

describe('Apps Script response bridge origins', () => {
  it('accepts only HTTPS Google script response origins', () => {
    expect(isGoogleBridgeOrigin('https://script.google.com')).toBe(true);
    expect(isGoogleBridgeOrigin('https://script.googleusercontent.com')).toBe(true);
    expect(isGoogleBridgeOrigin('https://example.googleusercontent.com')).toBe(true);
    expect(isGoogleBridgeOrigin('http://script.google.com')).toBe(false);
    expect(isGoogleBridgeOrigin('https://script.google.com.example.test')).toBe(false);
    expect(isGoogleBridgeOrigin('null')).toBe(false);
  });
});
