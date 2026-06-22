import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminService, type CreateProductInput } from './admin.service';
import { ReportsService } from './reports.service';
import { AuthGuard, CurrentActor } from '../../common/auth.guard';
import type { AuthContext } from '../../common/authz';

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly reports: ReportsService,
  ) {}

  @Post('products')
  createProduct(@CurrentActor() a: AuthContext, @Body() body: CreateProductInput) {
    return this.admin.createProduct(a, body);
  }

  @Post('products/:id/active')
  setActive(@CurrentActor() a: AuthContext, @Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.admin.setProductActive(a, id, body.isActive);
  }

  @Post('branch-products')
  setListing(
    @CurrentActor() a: AuthContext,
    @Body() body: { productId: string; branchId: string; isListed: boolean },
  ) {
    return this.admin.setBranchListing(a, body.productId, body.branchId, body.isListed);
  }

  @Post('prices')
  setPrice(
    @CurrentActor() a: AuthContext,
    @Body() body: { productId: string; branchId?: string | null; price: number },
  ) {
    return this.admin.setPrice(a, body.productId, body.branchId ?? null, body.price);
  }

  @Post('stock')
  setStock(
    @CurrentActor() a: AuthContext,
    @Body() body: { branchId: string; productId: string; qtyAvailable: number },
  ) {
    return this.admin.setStock(a, body.branchId, body.productId, body.qtyAvailable);
  }

  @Get('branches')
  listBranches(@CurrentActor() a: AuthContext) {
    return this.admin.listBranches(a);
  }

  @Get('categories')
  listCategories(@CurrentActor() a: AuthContext) {
    return this.admin.listCategories(a);
  }

  @Post('branches')
  createBranch(
    @CurrentActor() a: AuthContext,
    @Body() body: { name: string; lat: number; lng: number; prepTimeMin?: number },
  ) {
    return this.admin.createBranch(a, body);
  }

  @Post('zones')
  createZone(
    @CurrentActor() a: AuthContext,
    @Body() body: { branchId: string; priority: number; polygon: object },
  ) {
    return this.admin.createZone(a, body.branchId, body.priority, body.polygon);
  }

  @Post('staff')
  createStaff(
    @CurrentActor() a: AuthContext,
    @Body() body: { name: string; phone: string; role: 'branch_operator' | 'branch_manager' | 'hq_admin'; branchId: string | null },
  ) {
    return this.admin.createStaff(a, body);
  }

  @Post('promotions')
  createPromotion(
    @CurrentActor() a: AuthContext,
    @Body()
    body: { code: string; type: 'pct' | 'fixed' | 'bogo'; value: number; minSubtotal: number; startsAt: string; endsAt: string },
  ) {
    return this.admin.createPromotion(a, {
      ...body,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
    });
  }

  @Get('reports/sales')
  sales(@CurrentActor() a: AuthContext, @Query('branchId') branchId?: string) {
    return this.reports.salesByBranch(a, branchId);
  }

  @Get('reports/funnel')
  funnel(@CurrentActor() a: AuthContext, @Query('branchId') branchId?: string) {
    return this.reports.orderFunnel(a, branchId);
  }

  @Get('reports/stock-health')
  stockHealth(@CurrentActor() a: AuthContext, @Query('branchId') branchId: string) {
    return this.reports.stockHealth(a, branchId);
  }
}
