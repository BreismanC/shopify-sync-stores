import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ProductSnapshot,
  ProductVariantSnapshot,
} from '../../domain/entities/product-snapshot.entity';
import {
  InventoryLocationMapping,
  ReconciliationCheckpoint,
  SyncBatch,
  SyncEvent,
  SyncSettings,
  SyncedProduct,
} from '../../domain/entities/sync.entity';
import {
  OrderLineMapping,
  Payout,
  SyncedOrder,
} from '../../domain/entities/order-sync.entity';
import { WebhookDelivery } from '../../domain/entities/notification.entity';
import {
  TypeOrmProductRepository,
  TypeOrmSyncRepository,
} from '../../infrastructure/repositories/sync/typeorm-sync.repositories';
// Los puertos de Shopify se re-exportan a través de ShopifyModule.
// No los importamos aquí para evitar UnknownExportException al re-exportarlos.
import { AuthModule } from '../auth/auth.module';
import { StoreModule } from '../store/store.module';
import { TenantModule } from '../tenant/tenant.module';
import {
  IProductRepository,
  ISyncRepository,
} from './repositories/sync.repositories';
import { SyncController } from './sync.controller';
import {
  CreateSyncBatchUseCase,
  GetProductsUseCase,
  GetProductSourcesUseCase,
  ProcessProductSyncJobUseCase,
  ProcessProductWebhookUseCase,
  ProductSourceAccessUseCase,
  QueueStoreReconciliationUseCase,
  ReconcileStoreUseCase,
  UpsertProductSnapshotUseCase,
  UpdateSyncSettingsUseCase,
} from './sync.use-cases';
import { SyncWorkerService } from '../../infrastructure/queue/sync-worker.service';
import { IInventoryRepository } from '../inventory/repositories/inventory.repository';
import { TypeOrmInventoryRepository } from '../../infrastructure/repositories/inventory/typeorm-inventory.repository';
import { ProcessInventoryWebhookUseCase } from '../inventory/inventory.use-cases';
import { InventoryController } from '../inventory/inventory.controller';
import { NotificationModule } from '../notification/notification.module';
import { IOrderRepository } from '../order/repositories/order.repository';
import { TypeOrmOrderRepository } from '../../infrastructure/repositories/order/typeorm-order.repository';
import {
  GetOrdersUseCase,
  ProcessOrderWebhookUseCase,
} from '../order/order.use-cases';
import { OrderController } from '../order/order.controller';
import { DashboardController } from '../dashboard/dashboard.controller';
import { IDashboardRepository } from '../dashboard/dashboard.repository';
import { TypeOrmDashboardRepository } from '../../infrastructure/repositories/dashboard/typeorm-dashboard.repository';
import { ShopifyModule } from '../shopify/shopify.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductSnapshot,
      ProductVariantSnapshot,
      SyncedProduct,
      SyncSettings,
      SyncBatch,
      SyncEvent,
      InventoryLocationMapping,
      ReconciliationCheckpoint,
      SyncedOrder,
      OrderLineMapping,
      Payout,
      WebhookDelivery,
    ]),
    AuthModule,
    TenantModule,
    StoreModule,
    NotificationModule,
    ShopifyModule,
  ],
  controllers: [
    SyncController,
    InventoryController,
    OrderController,
    DashboardController,
  ],
  providers: [
    TypeOrmProductRepository,
    TypeOrmSyncRepository,
    { provide: IProductRepository, useExisting: TypeOrmProductRepository },
    { provide: ISyncRepository, useExisting: TypeOrmSyncRepository },
    TypeOrmInventoryRepository,
    { provide: IInventoryRepository, useExisting: TypeOrmInventoryRepository },
    TypeOrmOrderRepository,
    { provide: IOrderRepository, useExisting: TypeOrmOrderRepository },
    TypeOrmDashboardRepository,
    { provide: IDashboardRepository, useExisting: TypeOrmDashboardRepository },
    ProductSourceAccessUseCase,
    GetProductSourcesUseCase,
    GetProductsUseCase,
    QueueStoreReconciliationUseCase,
    UpsertProductSnapshotUseCase,
    ReconcileStoreUseCase,
    UpdateSyncSettingsUseCase,
    CreateSyncBatchUseCase,
    ProcessProductSyncJobUseCase,
    ProcessProductWebhookUseCase,
    ProcessInventoryWebhookUseCase,
    GetOrdersUseCase,
    ProcessOrderWebhookUseCase,
    SyncWorkerService,
  ],
  exports: [
    IProductRepository,
    ISyncRepository,
    ProcessProductSyncJobUseCase,
    ReconcileStoreUseCase,
    ProcessProductWebhookUseCase,
    ProcessInventoryWebhookUseCase,
    ProcessOrderWebhookUseCase,
  ],
})
export class SyncModule {}
