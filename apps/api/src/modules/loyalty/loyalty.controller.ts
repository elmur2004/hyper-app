import { Controller, Get, UseGuards } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { AuthGuard, CurrentActor } from '../../common/auth.guard';
import type { AuthContext } from '../../common/authz';

@Controller('loyalty')
@UseGuards(AuthGuard)
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get('balance')
  async balance(@CurrentActor() actor: AuthContext) {
    return { points: await this.loyalty.balance(actor.userId) };
  }
}
