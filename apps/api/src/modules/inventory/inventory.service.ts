import { Injectable } from '@nestjs/common';
import type { ReservationResult } from '@hyper/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { tryReserve, tryRelease, tryFulfill } from './reservation';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private async snapshot(branchId: string, productId: string) {
    return this.prisma.inventory.findUnique({
      where: { productId_branchId: { productId, branchId } },
    });
  }

  private async result(
    ok: boolean,
    branchId: string,
    productId: string,
  ): Promise<ReservationResult> {
    if (ok) {
      const inv = await this.snapshot(branchId, productId);
      return { ok: true, qtyAvailable: inv!.qtyAvailable, qtyReserved: inv!.qtyReserved };
    }
    const exists = await this.snapshot(branchId, productId);
    return { ok: false, error: exists ? 'OUT_OF_STOCK' : 'NOT_FOUND' };
  }

  async place(branchId: string, productId: string, qty: number): Promise<ReservationResult> {
    if (qty <= 0) return { ok: false, error: 'INVALID_QTY' };
    return this.result(await tryReserve(this.prisma, branchId, productId, qty), branchId, productId);
  }

  async cancel(branchId: string, productId: string, qty: number): Promise<ReservationResult> {
    if (qty <= 0) return { ok: false, error: 'INVALID_QTY' };
    return this.result(await tryRelease(this.prisma, branchId, productId, qty), branchId, productId);
  }

  async fulfill(branchId: string, productId: string, qty: number): Promise<ReservationResult> {
    if (qty <= 0) return { ok: false, error: 'INVALID_QTY' };
    return this.result(await tryFulfill(this.prisma, branchId, productId, qty), branchId, productId);
  }

  /** HQ/operator stock set (absolute). Returns the new snapshot. */
  async setAvailable(branchId: string, productId: string, qtyAvailable: number) {
    return this.prisma.inventory.update({
      where: { productId_branchId: { productId, branchId } },
      data: { qtyAvailable },
    });
  }
}
