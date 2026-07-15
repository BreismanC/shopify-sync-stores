import { Store } from '../../../domain/entities/store.entity';

export abstract class IStoreRepository {
  abstract findByShopId(shopifyShopId: string): Promise<Store | null>;
  abstract findByTenantId(tenantId: string): Promise<Store[]>;
  abstract save(store: Store): Promise<Store>;
  abstract create(store: Partial<Store>): Store;
  abstract findByTenantIdPaginated(
    tenantId: string,
    options: {
      search?: string;
      page: number;
      perPage: number;
      sortBy: 'shopifyShopId' | 'role' | 'createdAt';
      order: 'asc' | 'desc';
    },
  ): Promise<{ data: Store[]; total: number }>;
  abstract findByStoreKey(storeKey: string): Promise<Store | null>;
}
