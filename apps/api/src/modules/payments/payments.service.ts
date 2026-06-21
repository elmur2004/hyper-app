import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CodProvider,
  PaymobProvider,
  type PaymentIntent,
  type PaymentProvider,
} from './payment.provider';

@Injectable()
export class PaymentsService {
  private readonly providers: Record<string, PaymentProvider>;

  constructor(private readonly prisma: PrismaService) {
    const cod = new CodProvider();
    const paymob = new PaymobProvider();
    this.providers = { cod: cod, paymob, online: paymob };
  }

  /** Create the payment intent for an order. COD → no online intent (settled on delivery). */
  async createIntentForOrder(orderId: string): Promise<PaymentIntent> {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const provider = order.paymentMethod === 'cod' ? this.providers.cod! : this.providers.paymob!;
    return provider.createIntent({ orderId: order.id, amount: order.total });
  }

  /**
   * Handle a signed payment webhook. The ONLY path that sets payment_status=paid (never the
   * client, Plan §6). Idempotent: a replayed webhook is a no-op via a unique processed key.
   */
  async handleWebhook(rawBody: string, signature: string): Promise<{ processed: boolean }> {
    const event = this.providers.paymob!.verifyWebhook(rawBody, signature);
    if (!event) throw new BadRequestException('invalid webhook signature');

    try {
      return await this.prisma.$transaction(async (tx) => {
        // De-dupe: the unique key blocks/rejects a replayed webhook.
        await tx.idempotencyKey.create({ data: { key: `webhook:${event.providerRef}` } });
        await tx.order.update({
          where: { id: event.orderId },
          data: { paymentStatus: event.status === 'paid' ? 'paid' : 'failed' },
        });
        return { processed: true };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { processed: false }; // already handled — idempotent no-op
      }
      throw e;
    }
  }

  /** Expose the Paymob signer for tests / a local webhook simulator. */
  signPaymob(rawBody: string): string {
    return (this.providers.paymob as PaymobProvider).sign(rawBody);
  }
}
