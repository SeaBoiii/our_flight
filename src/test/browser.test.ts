import { describe, expect, it, vi } from 'vitest';
import { createUuid } from '../browser';

describe('secure browser IDs', () => {
  it('uses the native UUID when available', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(uuid);
    expect(createUuid()).toBe(uuid);
  });

  it('creates distinct version 4 UUIDs from secure random bytes on older browsers', () => {
    const nativeUuid = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
    const randomBytes = vi.spyOn(crypto, 'getRandomValues');
    try {
      const ids = Array.from({ length: 10 }, createUuid);
      expect(new Set(ids).size).toBe(ids.length);
      ids.forEach((id) => expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/));
      expect(randomBytes).toHaveBeenCalledTimes(ids.length);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: nativeUuid });
    }
  });
});
