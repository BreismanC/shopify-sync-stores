import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Repository } from 'typeorm';
import {
  ProductSnapshot,
  ProductVariantSnapshot,
} from '../../../domain/entities/product-snapshot.entity';
import {
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
}
