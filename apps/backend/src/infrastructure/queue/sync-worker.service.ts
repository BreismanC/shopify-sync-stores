import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import {
  ProcessProductSyncJobUseCase,
  ProcessProductWebhookUseCase,
  ProcessAppUninstalledWebhookUseCase,
  ProductSyncJobInput,
  ReconcileStoreUseCase,
} from '../../application/sync/sync.use-cases';
import {
  DispatchVendorProductSyncUseCase,
  ProcessProductRequestedUseCase,
  ProcessVendorProductSyncUseCase,
  ScanProductsForSyncUseCase,
} from '../../application/sync/product-sync-pipeline.use-cases';
import {
  InitialSyncScanRequested,
  ProductSyncRequested,
  ProductUpdated,
  InventorySyncRequested,
  InventoryUpdated,
  VendorProductSyncRequested,
  VendorInventorySyncRequested,
} from '../../application/sync/sync.events';
import { IQueuePublisher } from '../../application/ports/queue-publisher.port';
import { Inject } from '@nestjs/common';
import { QUEUE_NAMES } from './queue.constants';
import {
  DispatchVendorInventorySyncUseCase,
  ProcessInventorySyncRequestedUseCase,
  ProcessVendorInventorySyncUseCase,
} from '../../application/inventory/inventory.use-cases';
import { ProcessOrderWebhookUseCase } from '../../application/order/order.use-cases';
import { IWebhookDeliveryRepository } from '../../application/webhook/repositories/webhook-delivery.repository';
import { DistributedLockUnavailableError } from '../../application/ports/distributed-lock.port';

interface ReconciliationJobData {
  tenantId: string;
  notifyTenantId?: string;
  storeId: string;
}
interface WebhookJobData {
  tenantId?: string | null;
  storeId?: string | null;
  eventId: string;
  topic: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class SyncWorkerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(SyncWorkerService.name);
  private readonly workers: Worker[] = [];
  constructor(
    private readonly config: ConfigService,
    private readonly processProduct: ProcessProductSyncJobUseCase,
    private readonly processProductWebhook: ProcessProductWebhookUseCase,
    private readonly processAppUninstalled: ProcessAppUninstalledWebhookUseCase,
    private readonly reconcileStore: ReconcileStoreUseCase,
    private readonly processInventory: ProcessInventorySyncRequestedUseCase,
    private readonly processOrder: ProcessOrderWebhookUseCase,
    private readonly processProductRequested: ProcessProductRequestedUseCase,
    private readonly scanProducts: ScanProductsForSyncUseCase,
    private readonly dispatchVendor: DispatchVendorProductSyncUseCase,
    private readonly processVendor: ProcessVendorProductSyncUseCase,
    private readonly dispatchVendorInventory: DispatchVendorInventorySyncUseCase,
    private readonly processVendorInventory: ProcessVendorInventorySyncUseCase,
    @Inject(IQueuePublisher) private readonly queues: IQueuePublisher,
    @Inject(IWebhookDeliveryRepository)
    private readonly deliveries: IWebhookDeliveryRepository,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('RUN_WORKERS', 'false') !== 'true') return;
    const connection = {
      host: this.config.get<string>('REDIS_HOST', '127.0.0.1'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      db: this.config.get<number>('REDIS_DB', 0),
    };
    const prefix = this.config.get<string>('QUEUE_PREFIX', 'sss');
    const productConcurrency = this.toPositiveInt(
      this.config.get<unknown>('PRODUCT_WORKER_CONCURRENCY', 5),
      5,
    );
    const productWorker = new Worker(
      QUEUE_NAMES.PRODUCT_SYNC,
      async (job: Job) => {
        if (job.name === 'product-sync-requested')
          return this.withErrorClassification(() =>
            this.processProductRequested.execute(
              job.data as ProductSyncRequested,
            ),
          );
        return this.processProduct.execute(job.data as ProductSyncJobInput);
      },
      {
        connection,
        prefix,
        concurrency: productConcurrency,
      },
    );
    productWorker.on('failed', (job, error) => {
      if (job && this.isFinalFailure(job, error)) {
        const mark =
          job.name === 'product-sync-requested'
            ? this.processProductRequested.markPermanentlyFailed(
                job.data as ProductSyncRequested,
                error,
              )
            : this.processProduct.markPermanentlyFailed(
                job.data as ProductSyncJobInput,
                error,
              );
        void mark
          .then(() =>
            this.publishDeadLetter(QUEUE_NAMES.PRODUCT_SYNC, job, error),
          )
          .catch((failure: unknown) => this.logger.error(failure));
      }
    });
    const reconciliationWorker = new Worker(
      QUEUE_NAMES.RECONCILIATION,
      async (job: Job) => {
        if (job.name === 'scan-products')
          return this.scanProducts.execute(
            job.data as InitialSyncScanRequested,
          );
        if (job.name === 'reconcile-products')
          return this.reconcileStore.execute(job.data as ReconciliationJobData);
        if (job.name === 'app/uninstalled')
          return this.processAppUninstalled.execute(
            job.data as { storeId?: string | null },
          );
        throw new Error(`Unsupported reconciliation job: ${job.name}`);
      },
      { connection, prefix, concurrency: 1 },
    );
    this.attachWebhookLifecycle(
      reconciliationWorker,
      QUEUE_NAMES.RECONCILIATION,
    );
    reconciliationWorker.on('failed', (job, error) => {
      if (job?.name === 'scan-products' && this.isFinalFailure(job, error))
        void this.scanProducts
          .markPermanentlyFailed(job.data as InitialSyncScanRequested, error)
          .catch((failure: unknown) => this.logger.error(failure));
    });
    const productWebhookWorker = new Worker(
      QUEUE_NAMES.PRODUCT_WEBHOOK,
      async (job: Job) =>
        this.processProductWebhook.execute(job.data as WebhookJobData),
      { connection, prefix, concurrency: 3 },
    );
    this.attachWebhookLifecycle(
      productWebhookWorker,
      QUEUE_NAMES.PRODUCT_WEBHOOK,
    );
    const vendorWorker = new Worker(
      QUEUE_NAMES.VENDOR_SYNC,
      async (job: Job) => {
        if (job.name === 'product-updated' || job.name === 'product-deleted')
          return this.dispatchVendor.execute(job.data as ProductUpdated);
        if (job.name === 'vendor-product-sync-requested')
          return this.withErrorClassification(() =>
            this.processVendor.execute(job.data as VendorProductSyncRequested),
          );
        throw new Error(`Unsupported vendor job: ${job.name}`);
      },
      {
        connection,
        prefix,
        concurrency: this.toPositiveInt(
          this.config.get<unknown>('VENDOR_WORKER_CONCURRENCY', 5),
          5,
        ),
      },
    );
    vendorWorker.on('failed', (job, error) => {
      if (job && this.isFinalFailure(job, error)) {
        const mark =
          job.name === 'vendor-product-sync-requested'
            ? this.processVendor.markPermanentlyFailed(
                job.data as VendorProductSyncRequested,
                error,
              )
            : this.dispatchVendor.markPermanentlyFailed(
                job.data as ProductUpdated,
                error,
              );
        void mark
          .then(() =>
            this.publishDeadLetter(QUEUE_NAMES.VENDOR_SYNC, job, error),
          )
          .catch((failure: unknown) => this.logger.error(failure));
      }
    });
    const inventoryWorker = new Worker(
      QUEUE_NAMES.INVENTORY_SYNC,
      async (job: Job) =>
        this.withErrorClassification(() =>
          this.processInventory.execute(job.data as InventorySyncRequested),
        ),
      { connection, prefix, concurrency: 10 },
    );
    this.attachWebhookLifecycle(inventoryWorker, QUEUE_NAMES.INVENTORY_SYNC);
    inventoryWorker.on('failed', (job, error) => {
      if (job && this.isFinalFailure(job, error))
        void this.processInventory
          .markPermanentlyFailed(job.data as InventorySyncRequested, error)
          .catch((failure: unknown) => this.logger.error(failure));
    });
    const vendorInventoryWorker = new Worker(
      QUEUE_NAMES.VENDOR_INVENTORY_SYNC,
      async (job: Job) => {
        if (job.name === 'inventory-updated')
          return this.dispatchVendorInventory.execute(
            job.data as InventoryUpdated,
          );
        if (job.name === 'vendor-inventory-sync-requested')
          return this.withErrorClassification(() =>
            this.processVendorInventory.execute(
              job.data as VendorInventorySyncRequested,
            ),
          );
        throw new Error(`Unsupported vendor inventory job: ${job.name}`);
      },
      {
        connection,
        prefix,
        concurrency: this.toPositiveInt(
          this.config.get<unknown>('VENDOR_INVENTORY_WORKER_CONCURRENCY', 10),
          10,
        ),
      },
    );
    vendorInventoryWorker.on('failed', (job, error) => {
      if (job && this.isFinalFailure(job, error)) {
        const mark =
          job.name === 'vendor-inventory-sync-requested'
            ? this.processVendorInventory.markPermanentlyFailed(
                job.data as VendorInventorySyncRequested,
                error,
              )
            : Promise.resolve();
        void mark
          .then(() =>
            this.publishDeadLetter(
              QUEUE_NAMES.VENDOR_INVENTORY_SYNC,
              job,
              error,
            ),
          )
          .catch((failure: unknown) => this.logger.error(failure));
      }
    });
    const orderWorker = new Worker(
      QUEUE_NAMES.ORDER_SYNC,
      async (job: Job) => this.processOrder.execute(job.data as WebhookJobData),
      { connection, prefix, concurrency: 5 },
    );
    this.attachWebhookLifecycle(orderWorker, QUEUE_NAMES.ORDER_SYNC);
    this.workers.push(
      productWorker,
      productWebhookWorker,
      vendorWorker,
      reconciliationWorker,
      inventoryWorker,
      vendorInventoryWorker,
      orderWorker,
    );
    this.logger.log('Workers de productos y reconciliación iniciados.');
  }

  private attachDeadLetter(worker: Worker, queueName: string) {
    worker.on('failed', (job, error) => {
      if (job && this.isFinalFailure(job, error))
        void this.publishDeadLetter(queueName, job, error).catch(
          (failure: unknown) => this.logger.error(failure),
        );
    });
  }

  private attachWebhookLifecycle(worker: Worker, queueName: string) {
    worker.on('completed', (job) => {
      void this.updateDelivery(job, 'PROCESSED').catch((failure: unknown) =>
        this.logger.error(failure),
      );
    });
    worker.on('failed', (job, error) => {
      if (job && this.isFinalFailure(job, error)) {
        void Promise.all([
          this.updateDelivery(job, 'FAILED', error.message),
          this.publishDeadLetter(queueName, job, error),
        ]).catch((failure: unknown) => this.logger.error(failure));
      }
    });
  }

  private async updateDelivery(job: Job, status: string, error?: string) {
    const deliveryId = (job.data as { deliveryId?: string }).deliveryId;
    if (!deliveryId) return;
    const delivery = await this.deliveries.findById(deliveryId);
    if (!delivery) return;
    delivery.status = status;
    delivery.error = error ?? null;
    delivery.processedAt = new Date();
    await this.deliveries.save(delivery);
  }

  private async withErrorClassification<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof DistributedLockUnavailableError) throw error;
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      )
        throw new UnrecoverableError(error.message);
      throw error;
    }
  }

  private isFinalFailure(job: Job, error: Error) {
    return (
      error.name === 'UnrecoverableError' ||
      job.attemptsMade >= (job.opts.attempts ?? 1)
    );
  }

  private publishDeadLetter(queueName: string, job: Job, error: Error) {
    return this.queues.publish(
      QUEUE_NAMES.DEAD_LETTER,
      'dead-letter',
      {
        queue: queueName,
        jobName: job.name,
        jobId: job.id ? String(job.id) : null,
        attemptsMade: job.attemptsMade,
        payload: job.data as Record<string, unknown>,
        error: error.message,
        failedAt: new Date().toISOString(),
      },
      {
        attempts: 1,
        jobId: `dlq-${queueName}-${String(job.id)}-${job.attemptsMade}`,
      },
    );
  }

  async onApplicationShutdown() {
    await Promise.all(this.workers.map((worker) => worker.close()));
  }

  private toPositiveInt(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.floor(parsed);
      }
    }
    return fallback;
  }
}
