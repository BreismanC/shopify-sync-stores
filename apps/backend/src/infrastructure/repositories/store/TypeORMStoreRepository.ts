import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Store,
  normalizeStoreKey,
} from '../../../domain/entities/store.entity';
import { IStoreRepository } from '../../../application/store/repositories/IStoreRepository';

export const SAFE_STORE_FIELDS = [
  'id',
  'shopifyShopId',
  'role',
  'isActive',
  'storeKey',
  'tenantId',
  'createdAt',
  'updatedAt',
] as const;

@Injectable()
export class TypeORMStoreRepository implements IStoreRepository {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
  ) {}

  async findByShopId(shopifyShopId: string): Promise<Store | null> {
    return this.storeRepository.findOne({ where: { shopifyShopId } });
  }

  async findByTenantId(tenantId: string): Promise<Store[]> {
    return this.storeRepository.find({ where: { tenantId } });
  }

  async findByTenantIdPaginated(
    tenantId: string,
    options: {
      search?: string;
      page: number;
      perPage: number;
      sortBy: 'shopifyShopId' | 'role' | 'createdAt';
      order: 'asc' | 'desc';
    },
  ): Promise<{ data: Store[]; total: number }> {
    const qb = this.storeRepository
      .createQueryBuilder('store')
      .where('store.tenantId = :tenantId', { tenantId })
      .select([
        'store.id',
        'store.shopifyShopId',
        'store.role',
        'store.isActive',
        'store.storeKey',
        'store.tenantId',
        'store.createdAt',
        'store.updatedAt',
      ]);

    if (options.search) {
      qb.andWhere('LOWER(store.shopifyShopId) LIKE LOWER(:search)', {
        search: `%${options.search}%`,
      });
    }

    qb.orderBy(
      `store.${options.sortBy}`,
      options.order.toUpperCase() as 'ASC' | 'DESC',
    )
      .skip((options.page - 1) * options.perPage)
      .take(options.perPage);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findByStoreKey(storeKey: string): Promise<Store | null> {
    const normalized = normalizeStoreKey(storeKey);
    if (!normalized) return null;
    return this.storeRepository.findOne({
      where: { storeKey: normalized },
    });
  }

  async save(store: Store): Promise<Store> {
    return this.storeRepository.save(store);
  }

  create(store: Partial<Store>): Store {
    return this.storeRepository.create(store);
  }
}
