import { z } from 'zod';
import { brandedUuid } from './identity';
import { CustomerIdSchema } from './customers';
import { AddressIdSchema } from './customers';
import { BranchIdSchema } from './branches';
import { ProductIdSchema } from './catalog';
import { PiastresSchema } from './money';

/** Single source of truth for the order lifecycle (Plan §4). Transitions enforced server-side. */
export const OrderStatusSchema = z.enum([
  'placed',
  'confirmed',
  'picking',
  'packed',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refunded',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const PaymentMethodSchema = z.enum(['online', 'cod']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentStatusSchema = z.enum(['pending', 'paid', 'refunded', 'failed']);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const OrderIdSchema = brandedUuid('OrderId');
export type OrderId = z.infer<typeof OrderIdSchema>;

export const OrderSchema = z.object({
  id: OrderIdSchema,
  customerId: CustomerIdSchema,
  branchId: BranchIdSchema,
  addressId: AddressIdSchema,
  status: OrderStatusSchema,
  subtotal: PiastresSchema,
  deliveryFee: PiastresSchema,
  discount: PiastresSchema,
  total: PiastresSchema,
  paymentMethod: PaymentMethodSchema,
  paymentStatus: PaymentStatusSchema,
  slotStart: z.string().datetime().nullable(),
  slotEnd: z.string().datetime().nullable(),
  placedAt: z.string().datetime(),
  /** Monotonic version — lets realtime push + reconnect refetch order events (spike S3). */
  version: z.number().int().nonnegative(),
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderItemSchema = z.object({
  id: brandedUuid('OrderItemId'),
  orderId: OrderIdSchema,
  productId: ProductIdSchema,
  qty: z.number().int().positive(),
  unitPrice: PiastresSchema,
  lineTotal: PiastresSchema,
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderEventSchema = z.object({
  id: brandedUuid('OrderEventId'),
  orderId: OrderIdSchema,
  status: OrderStatusSchema,
  actor: z.string(),
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type OrderEvent = z.infer<typeof OrderEventSchema>;

// --- Realtime contract (spike S3) ---

/** Small payload pushed on a per-order channel (Plan §5: keep payloads small). */
export const OrderStatusEventSchema = z.object({
  orderId: OrderIdSchema,
  status: OrderStatusSchema,
  version: z.number().int().nonnegative(),
  branchId: BranchIdSchema,
  occurredAt: z.string().datetime(),
});
export type OrderStatusEvent = z.infer<typeof OrderStatusEventSchema>;

/** Authoritative DTO returned by GET /orders/:id (used by the reconnect refetch). */
export const OrderReadDtoSchema = OrderSchema;
export type OrderReadDto = z.infer<typeof OrderReadDtoSchema>;

const ORDER_CHANNEL_PREFIX = 'order:';
const BRANCH_CHANNEL_PREFIX = 'branch:';

export const orderChannelName = (orderId: string): string => `${ORDER_CHANNEL_PREFIX}${orderId}`;
export const parseOrderChannel = (channel: string): string | null =>
  channel.startsWith(ORDER_CHANNEL_PREFIX) ? channel.slice(ORDER_CHANNEL_PREFIX.length) : null;

export const branchChannelName = (branchId: string): string =>
  `${BRANCH_CHANNEL_PREFIX}${branchId}`;
export const parseBranchChannel = (channel: string): string | null =>
  channel.startsWith(BRANCH_CHANNEL_PREFIX) ? channel.slice(BRANCH_CHANNEL_PREFIX.length) : null;
