import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { OrderStatus } from '@hyper/shared';
import { OrdersService, type CheckoutItem } from './orders.service';
import { AuthGuard, CurrentActor } from '../../common/auth.guard';
import type { AuthContext } from '../../common/authz';
import type { PaymentMethod } from '@prisma/client';

@Controller()
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('orders/checkout')
  checkout(
    @CurrentActor() actor: AuthContext,
    @Body()
    body: {
      addressId: string;
      items: CheckoutItem[];
      paymentMethod?: PaymentMethod;
      idempotencyKey: string;
      promoCode?: string;
    },
  ) {
    return this.orders.checkout({
      customerId: actor.userId,
      addressId: body.addressId,
      items: body.items,
      paymentMethod: body.paymentMethod ?? 'cod',
      idempotencyKey: body.idempotencyKey,
      promoCode: body.promoCode,
    });
  }

  @Get('orders')
  list(@CurrentActor() actor: AuthContext) {
    return this.orders.listForCustomer(actor.userId);
  }

  @Get('orders/:id')
  get(@CurrentActor() actor: AuthContext, @Param('id') id: string) {
    return this.orders.getForActor(actor, id);
  }

  @Post('orders/:id/transition')
  transition(
    @CurrentActor() actor: AuthContext,
    @Param('id') id: string,
    @Body() body: { to: OrderStatus; note?: string },
  ) {
    return this.orders.transition(actor, id, body.to, body.note);
  }

  @Post('orders/:id/reorder')
  reorder(
    @CurrentActor() actor: AuthContext,
    @Param('id') id: string,
    @Body() body: { idempotencyKey: string },
  ) {
    return this.orders.reorder(actor.userId, id, body.idempotencyKey);
  }

  @Get('ops/queue')
  queue(@CurrentActor() actor: AuthContext, @Query('branchId') branchId?: string) {
    return this.orders.branchQueue(actor, branchId);
  }
}
