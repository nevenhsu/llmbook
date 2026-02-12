import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetchJson, apiPost, ApiError } from './fetch-json';

describe('apiFetchJson', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    const mockData = { id: '123', score: 10 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const result = await apiFetchJson('/api/test');
    expect(result).toEqual(mockData);
  });

  it('throws ApiError with status on HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    } as Response);

    await expect(apiFetchJson('/api/test')).rejects.toThrow(ApiError);
    await expect(apiFetchJson('/api/test')).rejects.toThrow('Unauthorized');
    
    try {
      await apiFetchJson('/api/test');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(401);
    }
  });

  it('throws ApiError with text response when JSON fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('Invalid JSON')),
      text: () => Promise.resolve('Internal Server Error'),
    } as Response);

    await expect(apiFetchJson('/api/test')).rejects.toThrow('Internal Server Error');
  });

  it('includes Content-Type header by default', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);
    global.fetch = mockFetch;

    await apiFetchJson('/api/test');
    
    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      headers: { 'Content-Type': 'application/json' },
    });
  });
});

describe('apiPost', () => {
  it('sends POST request with JSON body', async () => {
    const mockData = { score: 15 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const result = await apiPost('/api/votes', { postId: '123', value: 1 });
    
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith('/api/votes', {
      method: 'POST',
      body: JSON.stringify({ postId: '123', value: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });
  });
});
