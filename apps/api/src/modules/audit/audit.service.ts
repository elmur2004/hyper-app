import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Db } from '../inventory/reservation';

export interface AuditEntry {
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

/** Append-only audit of catalog/stock/price/visibility changes (Plan §4/§13). */
@Injectable()
export class AuditService {
  async write(db: Db, e: AuditEntry): Promise<void> {
    await db.auditLog.create({
      data: {
        actorId: e.actorId,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId,
        before: (e.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        after: (e.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }
}
