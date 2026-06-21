import { z } from 'zod';
import { brandedUuid, EgyptPhoneSchema } from './identity';
import { GeoJsonPointSchema } from './geo';

export const CustomerIdSchema = brandedUuid('CustomerId');
export type CustomerId = z.infer<typeof CustomerIdSchema>;

export const CustomerSchema = z.object({
  id: CustomerIdSchema,
  phone: EgyptPhoneSchema,
  name: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const AddressIdSchema = brandedUuid('AddressId');
export type AddressId = z.infer<typeof AddressIdSchema>;

export const AddressSchema = z.object({
  id: AddressIdSchema,
  customerId: CustomerIdSchema,
  label: z.string().min(1),
  location: GeoJsonPointSchema,
  text: z.string().min(1),
  isDefault: z.boolean(),
});
export type Address = z.infer<typeof AddressSchema>;
