import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { OrdersService } from '../orders/orders.service';
import { AuthGuard, CurrentActor } from '../../common/auth.guard';
import type { AuthContext } from '../../common/authz';

@Controller()
@UseGuards(AuthGuard)
export class DeliveryController {
  constructor(
    private readonly delivery: DeliveryService,
    private readonly orders: OrdersService,
  ) {}

  @Post('couriers')
  createCourier(
    @CurrentActor() a: AuthContext,
    @Body() body: { branchId: string; name: string; phone: string },
  ) {
    return this.delivery.createCourier(a, body);
  }

  @Post('orders/:id/assign-courier')
  assign(@CurrentActor() a: AuthContext, @Param('id') id: string, @Body() body: { courierId: string }) {
    return this.delivery.assign(a, id, body.courierId);
  }

  @Post('orders/:id/return')
  initiateReturn(@CurrentActor() a: AuthContext, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.orders.initiateReturn(a, id, body.reason);
  }
}
