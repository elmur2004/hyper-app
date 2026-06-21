import { BadRequestException, Injectable } from '@nestjs/common';
import type { Db } from '../inventory/reservation';

/** Server-enforced promotions (Plan §10 Phase 2). Discount is computed on the server only. */
@Injectable()
export class PromotionsService {
  /** Resolve a promo code against the current subtotal → discount in piastres (clamped). */
  async resolveDiscount(db: Db, code: string, subtotal: number): Promise<number> {
    const p = await db.promotion.findUnique({ where: { code } });
    if (!p || !p.active) throw new BadRequestException('invalid promo code');
    const now = Date.now();
    if (p.startsAt && p.startsAt.getTime() > now) throw new BadRequestException('promo not started');
    if (p.endsAt && p.endsAt.getTime() < now) throw new BadRequestException('promo expired');
    if (subtotal < p.minSubtotal) throw new BadRequestException('subtotal below promo minimum');

    let discount = 0;
    if (p.type === 'pct') discount = Math.floor((subtotal * p.value) / 100);
    else if (p.type === 'fixed') discount = Math.floor(p.value);
    // 'bogo' is line-level and handled in pricing polish; treated as 0 here.
    return Math.max(0, Math.min(discount, subtotal));
  }
}
