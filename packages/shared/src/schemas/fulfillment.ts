import { z } from 'zod';
import { brandedUuid, EgyptPhoneSchema } from './identity';
import { BranchIdSchema } from './branches';
import { GeoJsonPointSchema } from './geo';
import { OrderIdSchema } from './orders';

export const CourierIdSchema = brandedUuid('CourierId');
export type CourierId = z.infer<typeof CourierIdSchema>;

export const CourierSchema = z.object({
  id: CourierIdSchema,
  branchId: BranchIdSchema,
  name: z.string().min(1),
  phone: EgyptPhoneSchema,
  isAvailable: z.boolean(),
  lastLocation: GeoJsonPointSchema.nullable(),
});
export type Courier = z.infer<typeof CourierSchema>;

export const DeliveryStatusSchema = z.enum(['assigned', 'picked', 'delivered', 'failed']);
export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;

export const DeliverySchema = z.object({
  id: brandedUuid('DeliveryId'),
  orderId: OrderIdSchema,
  courierId: CourierIdSchema.nullable(),
  status: DeliveryStatusSchema,
  assignedAt: z.string().datetime().nullable(),
  pickedAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
});
export type Delivery = z.infer<typeof DeliverySchema>;
