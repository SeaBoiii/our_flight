import { cleanup } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { afterEach, vi } from 'vitest';
import { clearSavedGuestData } from '../storage';

Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: webcrypto as unknown as Crypto,
});

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

afterEach(() => {
  cleanup();
  clearSavedGuestData();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  // Begin the next simulated visit without tombstones retained by mocked
  // blocked removals in the cleanup above.
  clearSavedGuestData();
});
