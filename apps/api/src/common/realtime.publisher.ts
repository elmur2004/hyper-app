import { Injectable } from '@nestjs/common';
import { orderChannelName, branchChannelName, type OrderStatus } from '@hyper/shared';
import type { Db } from '../modules/inventory/reservation';

interface OrderLike {
  id: string;
  branchId: string;
  status: OrderStatus;
  version: number;
}

/**
 * Realtime publish (graduated from spike S3). Uses Postgres pg_notify, which is
 * transactional — events are delivered ONLY on COMMIT (post-commit by construction).
 * Emit on channel-per-order (customer tracking) AND channel-per-branch (HQ/ops firehose).
 * Production swaps the transport for managed realtime/Socket.IO behind this same call
 * and the OrderStatusEvent contract (ADR-0002).
 */
@Injectable()
export class RealtimePublisher {
  async publishStatus(db: Db, order: OrderLike): Promise<void> {
    const payload = JSON.stringify({
      orderId: order.id,
      status: order.status,
      version: order.version,
      branchId: order.branchId,
      occurredAt: new Date().toISOString(),
    });
    await db.$executeRaw`SELECT pg_notify(${orderChannelName(order.id)}, ${payload})`;
    await db.$executeRaw`SELECT pg_notify(${branchChannelName(order.branchId)}, ${payload})`;
  }
}
