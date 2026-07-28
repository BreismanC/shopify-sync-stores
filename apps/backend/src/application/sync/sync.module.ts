import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ProductSnapshot,
  ProductVariantSnapshot,
} from '../../domain/entities/product-snapshot.entity';
import {
  InventoryLocationMapping,
  InventorySnapshot,
  InitialSyncJob,
  ReconciliationCheckpoint,
  SyncBatch,
  SyncEvent,
  SyncSettings,
  SyncedProduct,
  VariantSync,
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
  ProcessAppUninstalledWebhookUseCase,
  ProductSourceAccessUseCase,
  QueueStoreReconciliationUseCase,
  ReconcileStoreUseCase,
  UpsertProductSnapshotUseCase,
  UpdateSyncSettingsUseCase,
} from './sync.use-cases';
import {
  DispatchVendorProductSyncUseCase,
  ProcessProductRequestedUseCase,
  ProcessVendorProductSyncUseCase,
  QueueInitialSyncUseCase,
  ScanProductsForSyncUseCase,
} from './product-sync-pipeline.use-cases';
import { SyncWorkerService } from '../../infrastructure/queue/sync-worker.service';
import { IInventoryRepository } from '../inventory/repositories/inventory.repository';
import { TypeOrmInventoryRepository } from '../../infrastructure/repositories/inventory/typeorm-inventory.repository';
import {
  DispatchVendorInventorySyncUseCase,
  ProcessInventorySyncRequestedUseCase,
  ProcessVendorInventorySyncUseCase,
} from '../inventory/inventory.use-cases';
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
import { WebhookModule } from '../webhook/webhook.module';

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
      InventorySnapshot,
      VariantSync,
      ReconciliationCheckpoint,
      SyncedOrder,
      OrderLineMapping,
      Payout,
      WebhookDelivery,
      InitialSyncJob,
    ]),
    AuthModule,
    TenantModule,
    StoreModule,
    NotificationModule,
    ShopifyModule,
    WebhookModule,
  ],
  controllers: [
    SyncController,
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
    ProcessAppUninstalledWebhookUseCase,
    QueueInitialSyncUseCase,
    ScanProductsForSyncUseCase,
    ProcessProductRequestedUseCase,
    DispatchVendorProductSyncUseCase,
    ProcessVendorProductSyncUseCase,
    ProcessInventorySyncRequestedUseCase,
    DispatchVendorInventorySyncUseCase,
    ProcessVendorInventorySyncUseCase,
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
    ProcessInventorySyncRequestedUseCase,
    DispatchVendorInventorySyncUseCase,
    ProcessVendorInventorySyncUseCase,
    ProcessOrderWebhookUseCase,
    QueueInitialSyncUseCase,
  ],
})
export class SyncModule {}
