import { createHmac, timingSafeEqual } from 'node:crypto';

export interface PaymentIntent {
  provider: string;
  ref: string;
  amount: number; // piastres
  /** COD has no online intent. */
  online: boolean;
  clientSecret?: string;
}

export interface PaymentWebhookEvent {
  providerRef: string;
  orderId: string;
  status: 'paid' | 'failed';
}

export interface PaymentProvider {
  readonly name: string;
  createIntent(input: { orderId: string; amount: number }): Promise<PaymentIntent>;
  /** Verify a signed webhook over the RAW body. Never trust the client for payment status. */
  verifyWebhook(rawBody: string, signature: string): PaymentWebhookEvent | null;
}

/** COD is first-class & default (Plan §2.4): no online intent, settled on delivery. */
export class CodProvider implements PaymentProvider {
  readonly name = 'cod';
  async createIntent(input: { orderId: string; amount: number }): Promise<PaymentIntent> {
    return { provider: this.name, ref: `cod:${input.orderId}`, amount: input.amount, online: false };
  }
  verifyWebhook(): PaymentWebhookEvent | null {
    return null; // COD has no webhook
  }
}

/**
 * Paymob (Egypt) behind the PaymentProvider interface. createIntent calls Paymob's API in
 * production (needs PAYMOB_API_KEY — external); here it returns a stub ref so the flow is
 * exercisable. verifyWebhook is real: HMAC-SHA512 over the raw body, timing-safe compared
 * to the signature. (Paymob's production HMAC is over a specific ordered field set — wire
 * that exact concatenation when integrating live keys; the verification mechanism is proven.)
 */
export class PaymobProvider implements PaymentProvider {
  readonly name = 'paymob';
  constructor(private readonly hmacSecret = process.env.PAYMOB_HMAC_SECRET ?? 'dev-paymob-hmac') {}

  async createIntent(input: { orderId: string; amount: number }): Promise<PaymentIntent> {
    // TODO(integration): POST to Paymob (auth → order → payment key) using PAYMOB_API_KEY.
    return {
      provider: this.name,
      ref: `paymob:${input.orderId}`,
      amount: input.amount,
      online: true,
      clientSecret: 'stub-payment-key',
    };
  }

  sign(rawBody: string): string {
    return createHmac('sha512', this.hmacSecret).update(rawBody).digest('hex');
  }

  verifyWebhook(rawBody: string, signature: string): PaymentWebhookEvent | null {
    const expected = this.sign(rawBody);
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    try {
      const parsed = JSON.parse(rawBody) as { orderId: string; status: 'paid' | 'failed'; providerRef?: string };
      if (!parsed.orderId || (parsed.status !== 'paid' && parsed.status !== 'failed')) return null;
      return { orderId: parsed.orderId, status: parsed.status, providerRef: parsed.providerRef ?? expected };
    } catch {
      return null;
    }
  }
}
