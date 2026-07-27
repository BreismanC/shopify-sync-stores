import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import {
  ProcessProductSyncJobUseCase,
  ProcessProductWebhookUseCase,
  ProductSyncJobInput,
  ReconcileStoreUseCase,
} from '../../application/sync/sync.use-cases';
import { QUEUE_NAMES } from './queue.constants';
import { ProcessInventoryWebhookUseCase } from '../../application/inventory/inventory.use-cases';
import { ProcessOrderWebhookUseCase } from '../../application/order/order.use-cases';

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
    private readonly reconcileStore: ReconcileStoreUseCase,
    private readonly processInventory: ProcessInventoryWebhookUseCase,
    private readonly processOrder: ProcessOrderWebhookUseCase,
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
      async (job: Job) =>
        this.processProduct.execute(job.data as ProductSyncJobInput),
      {
        connection,
        prefix,
        concurrency: productConcurrency,
      },
    );
    productWorker.on('failed', (job, error) => {
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        void this.processProduct
          .markPermanentlyFailed(job.data as ProductSyncJobInput, error)
          .catch((failure: unknown) => this.logger.error(failure));
      }
    });
    const reconciliationWorker = new Worker(
      QUEUE_NAMES.RECONCILIATION,
      async (job: Job) => {
        if (job.name === 'reconcile-products')
          return this.reconcileStore.execute(job.data as ReconciliationJobData);
        throw new Error(`Unsupported reconciliation job: ${job.name}`);
      },
      { connection, prefix, concurrency: 1 },
    );
    const productWebhookWorker = new Worker(
      QUEUE_NAMES.PRODUCT_WEBHOOK,
      async (job: Job) =>
        this.processProductWebhook.execute(job.data as WebhookJobData),
      { connection, prefix, concurrency: 3 },
    );
    const inventoryWorker = new Worker(
      QUEUE_NAMES.INVENTORY_SYNC,
      async (job: Job) =>
        this.processInventory.execute(job.data as WebhookJobData),
      { connection, prefix, concurrency: 10 },
    );
    const orderWorker = new Worker(
      QUEUE_NAMES.ORDER_SYNC,
      async (job: Job) => this.processOrder.execute(job.data as WebhookJobData),
      { connection, prefix, concurrency: 5 },
    );
    this.workers.push(
      productWorker,
      productWebhookWorker,
      reconciliationWorker,
      inventoryWorker,
      orderWorker,
    );
    this.logger.log('Workers de productos y reconciliación iniciados.');
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
