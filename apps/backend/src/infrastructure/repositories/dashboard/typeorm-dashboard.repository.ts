import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  DashboardMetrics,
  IDashboardRepository,
} from '../../../application/dashboard/dashboard.repository';

@Injectable()
export class TypeOrmDashboardRepository implements IDashboardRepository {
  constructor(private readonly dataSource: DataSource) {}
  async metrics(tenantId: string) {
    const rows = await this.dataSource.query<DashboardMetrics[]>(
      `
      SELECT
        (SELECT count(*)::int FROM product_snapshots WHERE "tenantId" = $1 AND "deletedAt" IS NULL) AS products,
        (SELECT count(*)::int FROM synced_products WHERE "tenantId" = $1 AND "isActive" = true) AS "syncedProducts",
        (SELECT count(*)::int FROM store_connections c JOIN stores s ON (s.id = c."sourceStoreId" OR s.id = c."vendorStoreId") WHERE s."tenantId" = $1 AND c."isActive" = true) AS "activeConnections",
        (SELECT count(*)::int FROM synced_orders o WHERE o."tenantId" = $1 OR EXISTS (SELECT 1 FROM stores s WHERE s."tenantId" = $1 AND (s.id = o."sourceStoreId" OR s.id = o."vendorStoreId"))) AS orders,
        (SELECT count(*)::int FROM sync_events WHERE "tenantId" = $1 AND status = 'FAILED') AS "failedSyncs",
        (SELECT count(*)::int FROM notifications WHERE "tenantId" = $1 AND "readAt" IS NULL AND "archivedAt" IS NULL) AS "unreadNotifications"
    `,
      [tenantId],
    );
    return rows[0];
  }
}
