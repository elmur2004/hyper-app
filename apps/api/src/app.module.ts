import { Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { TokenService } from './common/token.service';
import { AuthGuard } from './common/auth.guard';
import { RealtimePublisher } from './common/realtime.publisher';
import { AuditService } from './modules/audit/audit.service';
import { InventoryService } from './modules/inventory/inventory.service';
import { RoutingService } from './modules/routing/routing.service';
import { CatalogService } from './modules/catalog/catalog.service';
import { CatalogController } from './modules/catalog/catalog.controller';
import { OrdersService } from './modules/orders/orders.service';
import { OrdersController } from './modules/orders/orders.controller';
import { PromotionsService } from './modules/promotions/promotions.service';
import { DeliveryService } from './modules/delivery/delivery.service';
import { DeliveryController } from './modules/delivery/delivery.controller';
import { LoyaltyService } from './modules/loyalty/loyalty.service';
import { LoyaltyController } from './modules/loyalty/loyalty.controller';
import { AuthService } from './modules/auth/auth.service';
import { AuthController } from './modules/auth/auth.controller';
import { AdminService } from './modules/admin/admin.service';
import { ReportsService } from './modules/admin/reports.service';
import { AdminController } from './modules/admin/admin.controller';
import { PaymentsService } from './modules/payments/payments.service';
import { PaymentsController } from './modules/payments/payments.controller';
import { CustomerController } from './modules/customer/customer.controller';

@Module({
  controllers: [
    AuthController,
    CatalogController,
    OrdersController,
    AdminController,
    PaymentsController,
    CustomerController,
    DeliveryController,
    LoyaltyController,
  ],
  providers: [
    PrismaService,
    TokenService,
    AuthGuard,
    RealtimePublisher,
    AuditService,
    InventoryService,
    RoutingService,
    CatalogService,
    OrdersService,
    PromotionsService,
    DeliveryService,
    LoyaltyService,
    AuthService,
    AdminService,
    ReportsService,
    PaymentsService,
  ],
})
export class AppModule {}
