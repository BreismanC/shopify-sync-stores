import { StoreConnection } from '../../../domain/entities/store-connection.entity';

export const ISTORE_CONNECTION_REPOSITORY = 'ISTORE_CONNECTION_REPOSITORY';

export interface ListConnectionsOptions {
  search?: string;
  page: number;
  perPage: number;
  sortBy: 'connectedAt' | 'isActive';
  order: 'asc' | 'desc';
}

export interface StoreConnectionListItem {
  id: string;
  storeId: string;
  shopifyShopId: string;
  role: 'SOURCE' | 'VENDOR';
  isActive: boolean;
  connectedAt: Date;
  disconnectedAt: Date | null;
}

export abstract class IStoreConnectionRepository {
  abstract findById(id: string): Promise<StoreConnection | null>;
  abstract findPair(
    sourceStoreId: string,
    vendorStoreId: string,
  ): Promise<StoreConnection | null>;
  abstract create(connection: Partial<StoreConnection>): StoreConnection;
  abstract save(connection: StoreConnection): Promise<StoreConnection>;
  abstract findConnectedByStore(
    storeId: string,
    options: ListConnectionsOptions,
  ): Promise<{ data: StoreConnectionListItem[]; total: number }>;
  abstract findAccessibleByStore(
    storeId: string,
    connectionId: string,
  ): Promise<StoreConnection | null>;
  abstract hasActiveConnection(
    storeId: string,
    connectionId: string,
  ): Promise<boolean>;
}
