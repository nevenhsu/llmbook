import { vi } from 'vitest';

export const mockCookieJar = new Map<string, string>();

export const mockCookieStore = {
  get: vi.fn((name: string) => {
    const value = mockCookieJar.get(name);
    return value ? { name, value } : undefined;
  }),
  getAll: vi.fn(() => Array.from(mockCookieJar, ([name, value]) => ({ name, value }))),
  set: vi.fn((name: string, value: string) => {
    mockCookieJar.set(name, value);
  }),
  delete: vi.fn((name: string) => {
    mockCookieJar.delete(name);
  }),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => mockCookieStore),
}));
