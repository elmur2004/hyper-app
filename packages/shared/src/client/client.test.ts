import { describe, it, expect, vi } from 'vitest';
import { createApiClient, ApiError } from './index';

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }) as Response;

describe('createApiClient', () => {
  it('validates catalog responses against the shared schema', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, [
        {
          productId: '11111111-1111-1111-1111-111111111111',
          branchId: '22222222-2222-2222-2222-222222222222',
          nameAr: 'لبن',
          nameEn: 'Milk',
          imageUrls: [],
          unit: 'ea',
          price: 4500,
          inStock: true,
        },
      ]),
    );
    const api = createApiClient({ baseUrl: 'http://x', fetchImpl: fetchImpl as unknown as typeof fetch });
    const rows = await api.catalog('22222222-2222-2222-2222-222222222222');
    expect(rows[0]?.price).toBe(4500);
  });

  it('attaches the bearer token on authed calls', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, []));
    const api = createApiClient({
      baseUrl: 'http://x',
      getToken: () => 'tok123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await api.orders.list();
    const [, init] = fetchImpl.mock.calls[0]!;
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer tok123');
  });

  it('throws ApiError on non-2xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(409, { message: 'OUT_OF_STOCK' }));
    const api = createApiClient({
      baseUrl: 'http://x',
      getToken: () => 't',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(
      api.orders.checkout({ addressId: 'a', items: [{ productId: 'p', qty: 1 }], idempotencyKey: 'k' }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
