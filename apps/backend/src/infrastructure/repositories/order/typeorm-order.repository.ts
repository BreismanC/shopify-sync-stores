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
    const [data, total] = await qb
      .orderBy('o.createdAt', 'DESC')
      .skip((query.page - 1) * query.perPage)
      .take(query.perPage)
      .getManyAndCount();
    return { data, total };
  }
  findPayout(tenantId: string, id: string) {
    return this.payouts.findOne({ where: { tenantId, id } });
  }
  findPayoutByOrder(tenantId: string, syncedOrderId: string) {
    return this.payouts.findOne({ where: { tenantId, syncedOrderId } });
  }
}
