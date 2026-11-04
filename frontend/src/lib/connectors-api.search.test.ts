import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn<typeof fetch>();

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage =
    new MemoryStorage();
  localStorage.setItem(
    'openjarvis-settings',
    JSON.stringify({ apiKey: 'test-api-key' }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  (globalThis as unknown as { localStorage?: MemoryStorage }).localStorage =
    undefined;
});

describe('searchConnectedSources', () => {
  it('sends an authenticated bounded search request and returns results', async () => {
    const results = [
      {
        source: 'gmail',
        title: 'Travel plan',
        author: 'Alex',
        timestamp: '2025-01-02',
        url: '',
        content: 'Flight details.',
      },
    ];
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { searchConnectedSources } = await import('./connectors-api');
    await expect(searchConnectedSources('flight plan', 3)).resolves.toEqual(results);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit?];
    expect((init?.headers as Record<string, string>)?.Authorization).toBeTruthy();
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      query: 'flight plan',
      top_k: 3,
    });
  });

  it('surfaces a backend search failure', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Search unavailable' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { searchConnectedSources } = await import('./connectors-api');

    await expect(searchConnectedSources('flight plan')).rejects.toThrow(
      'Search unavailable',
    );
  });
});
