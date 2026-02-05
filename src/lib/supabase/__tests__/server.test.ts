import { beforeEach, describe, expect, it, vi } from 'vitest';

let cookieStore: { getAll: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
let lastOptions: any;

const createServerClient = vi.fn((url: string, key: string, options: any) => {
  lastOptions = options;
  return { __mock: 'server-client', url, key };
});

vi.mock('@supabase/ssr', () => ({
  createServerClient,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => cookieStore),
}));

describe('server createClient', () => {
  beforeEach(() => {
    vi.resetModules();
    createServerClient.mockClear();
    lastOptions = undefined;
    cookieStore = {
      getAll: vi.fn(() => [{ name: 'a', value: '1' }]),
      set: vi.fn(),
    };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public';
  });

  it('creates a server client with cookie helpers', async () => {
    const { createClient } = await import('../server');

    const client = await createClient();

    expect(client).toEqual({
      __mock: 'server-client',
      url: 'https://example.supabase.co',
      key: 'public',
    });
    expect(createServerClient).toHaveBeenCalledTimes(1);
    expect(lastOptions?.cookies?.getAll()).toEqual([{ name: 'a', value: '1' }]);
  });

  it('swallows cookie write errors in setAll', async () => {
    cookieStore.set.mockImplementation(() => {
      throw new Error('nope');
    });

    const { createClient } = await import('../server');
    await createClient();

    expect(() =>
      lastOptions.cookies.setAll([
        { name: 'session', value: 'x', options: { path: '/' } },
      ]),
    ).not.toThrow();
  });

  it('writes cookies via setAll when no error', async () => {
    const { createClient } = await import('../server');
    await createClient();

    lastOptions.cookies.setAll([
      { name: 'session', value: 'x', options: { path: '/' } },
    ]);

    expect(cookieStore.set).toHaveBeenCalledWith('session', 'x', { path: '/' });
  });
});
