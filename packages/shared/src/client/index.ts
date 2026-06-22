import { z } from 'zod';
import {
  CustomerCatalogRowSchema,
  type CustomerCatalogRow,
  ResolveZoneResponseSchema,
  type ResolveZoneResponse,
  type LatLng,
  type Order,
  type OrderItem,
  type OrderStatus,
} from '../schemas';

export interface ApiClientConfig {
  baseUrl: string;
  /** Returns the bearer token for authenticated requests (null when logged out). */
  getToken?: () => string | null | undefined;
  /** Injectable fetch (for tests / RN). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type OrderWithItems = Order & { items: OrderItem[] };

export interface CheckoutItemInput {
  productId: string;
  qty: number;
}

/**
 * The single typed API client both surfaces use (Plan §2.6). Responses are validated with
 * the shared Zod schemas so the client and server can never drift.
 */
export function createApiClient(config: ApiClientConfig) {
  const doFetch = config.fetchImpl ?? globalThis.fetch;

  async function req<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (init?.auth) {
      const token = config.getToken?.();
      if (token) headers['authorization'] = `Bearer ${token}`;
    }
    const res = await doFetch(`${config.baseUrl}${path}`, { ...init, headers: { ...headers, ...init?.headers } });
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok) throw new ApiError(res.status, `${init?.method ?? 'GET'} ${path} → ${res.status}`, json);
    return json as T;
  }

  return {
    auth: {
      requestOtp: (phone: string) =>
        req<{ challengeId: string; devCode?: string }>('/auth/otp/request', {
          method: 'POST',
          body: JSON.stringify({ phone }),
        }),
      verifyOtp: (phone: string, code: string) =>
        req<{ token: string; customerId: string }>('/auth/otp/verify', {
          method: 'POST',
          body: JSON.stringify({ phone, code }),
        }),
      staffLogin: (phone: string) =>
        req<{ token: string }>('/auth/staff/login', {
          method: 'POST',
          body: JSON.stringify({ phone }),
        }),
    },

    catalog: async (branchId: string): Promise<CustomerCatalogRow[]> => {
      const rows = await req<unknown>(`/catalog?branchId=${encodeURIComponent(branchId)}`);
      return z.array(CustomerCatalogRowSchema).parse(rows);
    },

    resolveZone: async (point: LatLng): Promise<ResolveZoneResponse> => {
      const res = await req<unknown>('/routing/resolve', {
        method: 'POST',
        body: JSON.stringify(point),
      });
      return ResolveZoneResponseSchema.parse(res);
    },

    addresses: {
      create: (body: { label: string; lat: number; lng: number; text: string; isDefault?: boolean }) =>
        req('/addresses', { method: 'POST', body: JSON.stringify(body), auth: true }),
      list: () => req('/addresses', { auth: true }),
    },

    orders: {
      checkout: (body: {
        addressId: string;
        items: CheckoutItemInput[];
        paymentMethod?: 'cod' | 'online';
        idempotencyKey: string;
      }) => req<OrderWithItems>('/orders/checkout', { method: 'POST', body: JSON.stringify(body), auth: true }),
      get: (id: string) => req<OrderWithItems>(`/orders/${id}`, { auth: true }),
      list: () => req<OrderWithItems[]>('/orders', { auth: true }),
      transition: (id: string, to: OrderStatus, note?: string) =>
        req<Order>(`/orders/${id}/transition`, {
          method: 'POST',
          body: JSON.stringify({ to, note }),
          auth: true,
        }),
      reorder: (id: string, idempotencyKey: string) =>
        req<OrderWithItems>(`/orders/${id}/reorder`, {
          method: 'POST',
          body: JSON.stringify({ idempotencyKey }),
          auth: true,
        }),
      branchQueue: (branchId?: string) =>
        req<OrderWithItems[]>(`/ops/queue${branchId ? `?branchId=${branchId}` : ''}`, { auth: true }),
      assignCourier: (id: string, courierId: string) =>
        req(`/orders/${id}/assign-courier`, { method: 'POST', body: JSON.stringify({ courierId }), auth: true }),
      initiateReturn: (id: string, reason?: string) =>
        req(`/orders/${id}/return`, { method: 'POST', body: JSON.stringify({ reason }), auth: true }),
    },

    loyalty: {
      balance: () => req<{ points: number }>('/loyalty/balance', { auth: true }),
    },

    // Central Command writes (HQ/branch staff — server enforces RBAC).
    admin: {
      createProduct: (body: {
        sku: string;
        nameAr: string;
        nameEn: string;
        categoryId: string;
        basePrice: number;
        unit: string;
        imageUrls?: string[];
      }) => req('/admin/products', { method: 'POST', body: JSON.stringify(body), auth: true }),
      setProductActive: (productId: string, isActive: boolean) =>
        req(`/admin/products/${productId}/active`, { method: 'POST', body: JSON.stringify({ isActive }), auth: true }),
      setBranchListing: (productId: string, branchId: string, isListed: boolean) =>
        req('/admin/branch-products', { method: 'POST', body: JSON.stringify({ productId, branchId, isListed }), auth: true }),
      setStock: (branchId: string, productId: string, qtyAvailable: number) =>
        req('/admin/stock', { method: 'POST', body: JSON.stringify({ branchId, productId, qtyAvailable }), auth: true }),
      setPrice: (productId: string, branchId: string | null, price: number) =>
        req('/admin/prices', { method: 'POST', body: JSON.stringify({ productId, branchId, price }), auth: true }),
      listBranches: () =>
        req<{ id: string; name: string; isActive: boolean }[]>('/admin/branches', { auth: true }),
      listCategories: () =>
        req<{ id: string; nameAr: string; nameEn: string }[]>('/admin/categories', { auth: true }),
      createBranch: (body: { name: string; lat: number; lng: number }) =>
        req('/admin/branches', { method: 'POST', body: JSON.stringify(body), auth: true }),
      createZone: (body: { branchId: string; priority: number; polygon: object }) =>
        req('/admin/zones', { method: 'POST', body: JSON.stringify(body), auth: true }),
      createPromotion: (body: {
        code: string;
        type: 'pct' | 'fixed' | 'bogo';
        value: number;
        minSubtotal: number;
        startsAt: string;
        endsAt: string;
      }) => req('/admin/promotions', { method: 'POST', body: JSON.stringify(body), auth: true }),
      salesByBranch: (branchId?: string) =>
        req(`/admin/reports/sales${branchId ? `?branchId=${branchId}` : ''}`, { auth: true }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
