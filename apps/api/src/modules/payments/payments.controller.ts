import { Body, Controller, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '../../common/auth.guard';

interface RawBodyRequest {
  rawBody?: Buffer;
  body?: unknown;
}

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Signed webhook — public but signature-verified; the ONLY path that marks paid. */
  @Post('payments/webhook')
  webhook(@Req() req: RawBodyRequest, @Headers('x-paymob-signature') signature?: string) {
    const raw = req.rawBody?.toString() ?? JSON.stringify(req.body ?? {});
    return this.payments.handleWebhook(raw, signature ?? '');
  }

  @Post('orders/:id/payment-intent')
  @UseGuards(AuthGuard)
  intent(@Param('id') id: string) {
    return this.payments.createIntentForOrder(id);
  }

  // (body param kept for non-rawBody fallback environments)
  @Post('payments/webhook-json')
  webhookJson(@Body() body: unknown, @Headers('x-paymob-signature') signature?: string) {
    return this.payments.handleWebhook(JSON.stringify(body ?? {}), signature ?? '');
  }
}
