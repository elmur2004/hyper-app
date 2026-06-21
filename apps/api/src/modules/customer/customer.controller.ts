import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthGuard, CurrentActor } from '../../common/auth.guard';
import type { AuthContext } from '../../common/authz';

/** Customer self-service: address book (with the map pin lat/lng from the app). */
@Controller()
@UseGuards(AuthGuard)
export class CustomerController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('addresses')
  createAddress(
    @CurrentActor() actor: AuthContext,
    @Body() body: { label: string; lat: number; lng: number; text: string; isDefault?: boolean },
  ) {
    return this.prisma.address.create({
      data: {
        customerId: actor.userId,
        label: body.label,
        lat: body.lat,
        lng: body.lng,
        text: body.text,
        isDefault: body.isDefault ?? false,
      },
    });
  }

  @Get('addresses')
  listAddresses(@CurrentActor() actor: AuthContext) {
    return this.prisma.address.findMany({ where: { customerId: actor.userId } });
  }
}
