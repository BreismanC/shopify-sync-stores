import {
  OrderLineMapping,
  Payout,
  SyncedOrder,
} from '../../../domain/entities/order-sync.entity';

export interface OrderListQuery {
  page: number;
  perPage: number;
  status?: string;
  storeId?: string;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'status';
  order?: 'asc' | 'desc';
}

export abstract class IOrderRepository {
  abstract findSynced(
    connectionId: string,
    vendorShopifyOrderId: string,
    sourceStoreId: string,
  ): Promise<SyncedOrder | null>;
  abstract saveOrder(order: SyncedOrder): Promise<SyncedOrder>;
  abstract createOrder(input: Partial<SyncedOrder>): SyncedOrder;
  abstract saveLines(lines: OrderLineMapping[]): Promise<OrderLineMapping[]>;
  abstract createLine(input: Partial<OrderLineMapping>): OrderLineMapping;
  abstract savePayout(payout: Payout): Promise<Payout>;
  abstract createPayout(input: Partial<Payout>): Payout;
  abstract list(
    tenantId: string,
    query: OrderListQuery,
  ): Promise<{ data: SyncedOrder[]; total: number }>;
  abstract findById(tenantId: string, id: string): Promise<SyncedOrder | null>;
  abstract findLinesByOrder(
    tenantId: string,
    syncedOrderId: string,
  ): Promise<OrderLineMapping[]>;
  abstract findPayout(tenantId: string, id: string): Promise<Payout | null>;
  abstract findPayoutByOrder(
    tenantId: string,
    syncedOrderId: string,
  ): Promise<Payout | null>;
}
