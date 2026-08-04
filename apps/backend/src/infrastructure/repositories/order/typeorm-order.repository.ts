import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OrderLineMapping,
  Payout,
  SyncedOrder,
} from '../../../domain/entities/order-sync.entity';
import {
  IOrderRepository,
  OrderListQuery,
} from '../../../application/order/repositories/order.repository';

@Injectable()
export class TypeOrmOrderRepository implements IOrderRepository {
  constructor(
    @InjectRepository(SyncedOrder)
    private readonly orders: Repository<SyncedOrder>,
    @InjectRepository(OrderLineMapping)
    private readonly lines: Repository<OrderLineMapping>,
    @InjectRepository(Payout) private readonly payouts: Repository<Payout>,
  ) {}
  findSynced(
    connectionId: string,
    vendorShopifyOrderId: string,
    sourceStoreId: string,
  ) {
    return this.orders.findOne({
      where: { connectionId, vendorShopifyOrderId, sourceStoreId },
    });
  }
  saveOrder(order: SyncedOrder) {
    return this.orders.save(order);
  }
  createOrder(input: Partial<SyncedOrder>) {
    return this.orders.create(input);
  }
  saveLines(lines: OrderLineMapping[]) {
    return this.lines.save(lines);
  }
  createLine(input: Partial<OrderLineMapping>) {
    return this.lines.create(input);
  }
  savePayout(payout: Payout) {
    return this.payouts.save(payout);
  }
  createPayout(input: Partial<Payout>) {
    return this.payouts.create(input);
  }
  async list(tenantId: string, query: OrderListQuery) {
    const qb = this.orders
      .createQueryBuilder('o')
      .where(
        '(o.tenantId = :tenantId OR EXISTS (SELECT 1 FROM stores s WHERE s."tenantId" = :tenantId AND (s.id = o."sourceStoreId" OR s.id = o."vendorStoreId")))',
        { tenantId },
      );
    if (query.status)
      qb.andWhere('o.status = :status', { status: query.status });
    if (query.storeId)
      qb.andWhere(
        '(o.sourceStoreId = :storeId OR o.vendorStoreId = :storeId)',
        { storeId: query.storeId },
      );
    if (query.search && query.search.trim().length > 0) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        "(LOWER(o.vendorShopifyOrderId) LIKE :term OR LOWER(COALESCE(o.sourceShopifyOrderId, '') ) LIKE :term OR LOWER(o.id) LIKE :term OR LOWER(CAST(o.payload->>'name' AS text)) LIKE :term OR LOWER(CAST(o.payload->>'email' AS text)) LIKE :term)",
        { term },
      );
    }
    const sortBy = query.sortBy ?? 'createdAt';
    const order = query.order ?? 'desc';
    const [data, total] = await qb
      .orderBy(`o.${sortBy}`, order.toUpperCase() as 'ASC' | 'DESC')
      .skip((query.page - 1) * query.perPage)
      .take(query.perPage)
      .getManyAndCount();
    return { data, total };
  }
  findById(tenantId: string, id: string) {
    return this.orders
      .createQueryBuilder('o')
      .where(
        '(o.tenantId = :tenantId OR EXISTS (SELECT 1 FROM stores s WHERE s."tenantId" = :tenantId AND (s.id = o."sourceStoreId" OR s.id = o."vendorStoreId")))',
        { tenantId },
      )
      .andWhere('o.id = :id', { id })
      .getOne();
  }
  findLinesByOrder(tenantId: string, syncedOrderId: string) {
    return this.lines.find({
      where: { tenantId, syncedOrderId },
      order: { createdAt: 'ASC' },
    });
  }
  findPayout(tenantId: string, id: string) {
    return this.payouts.findOne({ where: { tenantId, id } });
  }
  findPayoutByOrder(tenantId: string, syncedOrderId: string) {
    return this.payouts.findOne({ where: { tenantId, syncedOrderId } });
  }
}
