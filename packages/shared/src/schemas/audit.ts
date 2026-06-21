import { z } from 'zod';
import { brandedUuid } from './identity';

/** Who changed catalog/stock/price/visibility (Plan §4, §13). Written transactionally. */
export const AuditLogSchema = z.object({
  id: brandedUuid('AuditLogId'),
  actorId: z.string(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  createdAt: z.string().datetime(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;
