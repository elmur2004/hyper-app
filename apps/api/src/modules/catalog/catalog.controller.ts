import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ResolveZoneRequestSchema, type ResolveZoneRequest } from '@hyper/shared';
import { ZodBody } from '../../common/zod.pipe';
import { CatalogService } from './catalog.service';
import { RoutingService } from '../routing/routing.service';

/** Public browse surface: the customer app reads the derived catalog and resolves zones. */
@Controller()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly routing: RoutingService,
  ) {}

  @Get('catalog')
  forBranch(@Query('branchId') branchId: string) {
    return this.catalog.forBranch(branchId);
  }

  @Post('routing/resolve')
  resolve(@Body(new ZodBody(ResolveZoneRequestSchema)) body: ResolveZoneRequest) {
    return this.routing.resolve(body);
  }
}
