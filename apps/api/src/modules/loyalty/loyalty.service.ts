import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Db } from '../inventory/reservation';

const POINTS_PER_EGP = 1; // total is piastres → 1 point per whole EGP

/** Loyalty points (Plan §1.1 / Phase 5). Earned on delivery, reversed on return. */
@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async earn(db: Db, customerId: string, orderId: string, totalPiastres: number): Promise<void> {
    const points = Math.floor(totalPiastres / 100) * POINTS_PER_EGP;
    if (points <= 0) return;
    await db.loyaltyAccount.upsert({
      where: { customerId },
      create: { customerId, points },
      update: { points: { increment: points } },
    });
    await db.loyaltyLedger.create({
      data: { customerId, orderId, delta: points, reason: 'earn:delivery' },
    });
  }

  async reverseForOrder(db: Db, customerId: string, orderId: string): Promise<void> {
    const earned = await db.loyaltyLedger.findFirst({
      where: { customerId, orderId, reason: 'earn:delivery' },
    });
    if (!earned) return;
    await db.loyaltyAccount.update({
      where: { customerId },
      data: { points: { decrement: earned.delta } },
    });
    await db.loyaltyLedger.create({
      data: { customerId, orderId, delta: -earned.delta, reason: 'reverse:return' },
    });
  }

  async balance(customerId: string): Promise<number> {
    const acct = await this.prisma.loyaltyAccount.findUnique({ where: { customerId } });
    return acct?.points ?? 0;
  }
}
