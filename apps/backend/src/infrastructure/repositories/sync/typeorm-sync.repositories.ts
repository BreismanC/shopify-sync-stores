import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Repository } from 'typeorm';
import {
  ProductSnapshot,
  ProductVariantSnapshot,
} from '../../../domain/entities/product-snapshot.entity';
import {
  InitialSyncJob,
  SyncBatch,
  SyncEvent,
  SyncSettings,
  SyncedProduct,
} from '../../../domain/entities/sync.entity';
import { SyncBatchStatus } from '../../../domain/enums/sync-status.enum';
import {
  IProductRepository,
  ISyncRepository,
  ProductListQuery,
} from '../../../application/sync/repositories/sync.repositories';

@Injectable()
export class TypeOrmProductRepository implements IProductRepository {
  constructor(
    @InjectRepository(ProductSnapshot)
    private readonly repository: Repository<ProductSnapshot>,
    @InjectRepository(ProductVariantSnapshot)
    private readonly variants: Repository<ProductVariantSnapshot>,
  ) {}

  async listByStore(storeId: string, query: ProductListQuery) {
    const qb = this.repository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.variants', 'variants')
      .where('p.storeId = :storeId', { storeId })
      .andWhere('p.deletedAt IS NULL');
    if (query.search)
      qb.andWhere(
        new Brackets((inner) =>
          inner
            .where('LOWER(p.title) LIKE LOWER(:search)', {
              search: `%${query.search}%`,
            })
            .orWhere('LOWER(variants.sku) LIKE LOWER(:search)', {
              search: `%${query.search}%`,
            }),
        ),
      );
    const sort = query.sortBy === 'title' ? 'p.title' : 'p.createdAt';
    const [data, total] = await qb
      .orderBy(sort, query.order.toUpperCase() as 'ASC' | 'DESC')
      .skip((query.page - 1) * query.perPage)
      .take(query.perPage)
      .getManyAndCount();
    return { data, total };
  }

  countByStore(storeId: string) {
    return this.repository.count({ where: { storeId, deletedAt: IsNull() } });
  }

  findAllByStore(storeId: string) {
    return this.repository.find({
      where: { storeId, deletedAt: IsNull() },
      relations: { variants: true },
    });
  }

  listIdsByStore(storeId: string, offset: number, limit: number) {
    return this.repository.find({
      select: { id: true, shopifyProductId: true },
      where: { storeId, deletedAt: IsNull() },
      order: { id: 'ASC' },
      skip: offset,
      take: limit,
    });
  }

  findByIdsForStore(storeId: string, ids: string[]) {
    return this.repository.find({
      where: { storeId, id: In(ids), deletedAt: IsNull() },
      relations: { variants: true },
    });
  }

  findByIdForStore(storeId: string, id: string) {
    return this.repository.findOne({
      where: { storeId, id, deletedAt: IsNull() },
      relations: { variants: true },
    });
  }

  findById(tenantId: string, id: string) {
    return this.repository.findOne({
      where: { tenantId, id, deletedAt: IsNull() },
      relations: { variants: true },
    });
  }

  findByShopifyId(storeId: string, shopifyProductId: string) {
    return this.repository.findOne({
      where: { storeId, shopifyProductId },
      relations: { variants: true },
    });
  }

  save(product: ProductSnapshot) {
    return this.repository.save(product);
  }

  create(input: Partial<ProductSnapshot>) {
    return this.repository.create(input);
  }

  findVariantByInventoryItem(storeId: string, shopifyInventoryItemId: string) {
    return this.variants.findOne({
      where: { storeId, shopifyInventoryItemId },
      relations: { product: true },
    });
  }

  findVariantById(storeId: string, id: string) {
    return this.variants.findOne({
      where: { storeId, id },
      relations: { product: true },
    });
  }

  findVariantBySku(storeId: string, sku: string) {
    return this.variants.findOne({
      where: { storeId, sku },
      relations: { product: true },
    });
  }
}

@Injectable()
export class TypeOrmSyncRepository implements ISyncRepository {
  constructor(
    @InjectRepository(SyncSettings)
    private readonly settings: Repository<SyncSettings>,
    @InjectRepository(SyncBatch)
    private readonly batches: Repository<SyncBatch>,
    @InjectRepository(SyncEvent) private readonly events: Repository<SyncEvent>,
    @InjectRepository(SyncedProduct)
    private readonly products: Repository<SyncedProduct>,
    @InjectRepository(InitialSyncJob)
    private readonly initialSyncJobs: Repository<InitialSyncJob>,
  ) {}

  getSettings(tenantId: string, connectionId: string | null) {
    return this.settings.findOne({
      where: { tenantId, connectionId: connectionId ?? IsNull() },
    });
  }

  saveSettings(settings: SyncSettings) {
    return this.settings.save(settings);
  }

  createSettings(input: Partial<SyncSettings>) {
    return this.settings.create(input);
  }

  createBatch(input: Partial<SyncBatch>) {
    return this.batches.create(input);
  }

  saveBatch(batch: SyncBatch) {
    return this.batches.save(batch);
  }

  async setBatchTotalAndRunning(batchId: string, total: number) {
    const batch = await this.batches.findOne({ where: { id: batchId } });
    if (!batch) return null;
    batch.total = total;
    batch.startedAt ??= new Date();
    if (batch.processed >= total) {
      batch.status =
        batch.failed === 0
          ? SyncBatchStatus.COMPLETED
          : batch.succeeded === 0
            ? SyncBatchStatus.FAILED
            : SyncBatchStatus.PARTIAL;
      batch.finishedAt ??= new Date();
    } else {
      batch.status = SyncBatchStatus.RUNNING;
    }
    return this.batches.save(batch);
  }

  async failBatch(batchId: string, error: string) {
    const batch = await this.batches.findOne({ where: { id: batchId } });
    if (!batch || batch.finishedAt) return batch;
    batch.status = SyncBatchStatus.FAILED;
    batch.finishedAt = new Date();
    batch.summary = { ...batch.summary, scanError: error };
    return this.batches.save(batch);
  }

  async recordBatchResult(
    batchId: string,
    result: 'succeeded' | 'failed' | 'skipped',
  ) {
    await this.batches
      .createQueryBuilder()
      .update(SyncBatch)
      .set({
        processed: () => 'processed + 1',
        [result]: () => `${result} + 1`,
      })
      .where('id = :batchId', { batchId })
      .andWhere('processed < total')
      .execute();
    const batch = await this.batches.findOne({ where: { id: batchId } });
    if (batch && batch.processed >= batch.total && !batch.finishedAt) {
      batch.status =
        batch.failed === 0
          ? SyncBatchStatus.COMPLETED
          : batch.succeeded === 0
            ? SyncBatchStatus.FAILED
            : SyncBatchStatus.PARTIAL;
      batch.finishedAt = new Date();
      batch.summary = {
        succeeded: batch.succeeded,
        failed: batch.failed,
        skipped: batch.skipped,
      };
      return this.batches.save(batch);
    }
    return batch;
  }

  findBatch(tenantId: string, id: string) {
    return this.batches.findOne({ where: { tenantId, id } });
  }

  findActiveBatch(tenantId: string, sourceStoreId: string) {
    return this.batches.findOne({
      where: {
        tenantId,
        sourceStoreId,
        status: In([SyncBatchStatus.PENDING, SyncBatchStatus.RUNNING]),
      },
      order: { createdAt: 'DESC' },
    });
  }

  createEvent(input: Partial<SyncEvent>) {
    return this.events.create(input);
  }

  saveEvent(event: SyncEvent) {
    return this.events.save(event);
  }

  findEventByKey(idempotencyKey: string) {
    return this.events.findOne({ where: { idempotencyKey } });
  }

  findSyncedProduct(connectionId: string, sourceProductId: string) {
    return this.products.findOne({ where: { connectionId, sourceProductId } });
  }

  findSyncedProductByVendorId(
    connectionId: string,
    vendorShopifyProductId: string,
  ) {
    const gid = vendorShopifyProductId.startsWith('gid://')
      ? vendorShopifyProductId
      : `gid://shopify/Product/${vendorShopifyProductId}`;
    return this.products
      .createQueryBuilder('p')
      .where('p.connectionId = :connectionId', { connectionId })
      .andWhere(
        '(p.vendorShopifyProductId = :raw OR p.vendorShopifyProductId = :gid)',
        { raw: vendorShopifyProductId, gid },
      )
      .getOne();
  }

  createSyncedProduct(input: Partial<SyncedProduct>) {
    return this.products.create(input);
  }

  saveSyncedProduct(product: SyncedProduct) {
    return this.products.save(product);
  }

  findActiveSyncedProducts(sourceStoreId: string, sourceProductId: string) {
    return this.products.find({
      where: {
        sourceStoreId,
        sourceProductId,
        isActive: true,
        syncEnabled: true,
      },
    });
  }

  async findSyncedProductIds(connectionId: string, sourceProductIds: string[]) {
    if (sourceProductIds.length === 0) return [];
    const mappings = await this.products.find({
      select: { sourceProductId: true },
      where: {
        connectionId,
        sourceProductId: In(sourceProductIds),
        status: 'SYNCED',
        isActive: true,
      },
    });
    return mappings.map((mapping) => mapping.sourceProductId);
  }

  createInitialSyncJob(input: Partial<InitialSyncJob>) {
    return this.initialSyncJobs.create(input);
  }

  saveInitialSyncJob(job: InitialSyncJob) {
    return this.initialSyncJobs.save(job);
  }

  findInitialSyncJob(tenantId: string, id: string) {
    return this.initialSyncJobs.findOne({ where: { tenantId, id } });
  }

  findActiveInitialSyncJob(tenantId: string, storeId: string) {
    return this.initialSyncJobs.findOne({
      where: {
        tenantId,
        storeId,
        status: In([SyncBatchStatus.PENDING, SyncBatchStatus.RUNNING]),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async setInitialSyncTotalAndRunning(id: string, total: number) {
    const job = await this.initialSyncJobs.findOne({ where: { id } });
    if (!job) return null;
    job.totalProducts = total;
    job.startedAt ??= new Date();
    if (job.processedProducts >= total) {
      job.status =
        job.failedProducts === 0
          ? SyncBatchStatus.COMPLETED
          : job.succeededProducts === 0
            ? SyncBatchStatus.FAILED
            : SyncBatchStatus.PARTIAL;
      job.finishedAt ??= new Date();
    } else {
      job.status = SyncBatchStatus.RUNNING;
    }
    return this.initialSyncJobs.save(job);
  }

  async failInitialSyncJob(id: string, error: string) {
    const job = await this.initialSyncJobs.findOne({ where: { id } });
    if (!job || job.finishedAt) return job;
    job.status = SyncBatchStatus.FAILED;
    job.lastError = error;
    job.finishedAt = new Date();
    return this.initialSyncJobs.save(job);
  }

  async recordInitialSyncResult(
    id: string,
    result: 'succeeded' | 'failed',
    error?: string,
  ) {
    await this.initialSyncJobs
      .createQueryBuilder()
      .update(InitialSyncJob)
      .set({
        processedProducts: () => '"processedProducts" + 1',
        [result === 'succeeded' ? 'succeededProducts' : 'failedProducts']: () =>
          `"${result === 'succeeded' ? 'succeededProducts' : 'failedProducts'}" + 1`,
        ...(error ? { lastError: error } : {}),
      })
      .where('id = :id', { id })
      .andWhere('"processedProducts" < "totalProducts"')
      .execute();
    const job = await this.initialSyncJobs.findOne({ where: { id } });
    if (job && job.processedProducts >= job.totalProducts && !job.finishedAt) {
      job.status =
        job.failedProducts === 0
          ? SyncBatchStatus.COMPLETED
          : job.succeededProducts === 0
            ? SyncBatchStatus.FAILED
            : SyncBatchStatus.PARTIAL;
      job.finishedAt = new Date();
      return this.initialSyncJobs.save(job);
    }
    return job;
  }
}
