export interface DashboardMetrics {
  products: number;
  syncedProducts: number;
  activeConnections: number;
  orders: number;
  failedSyncs: number;
  unreadNotifications: number;
}
export abstract class IDashboardRepository {
  abstract metrics(tenantId: string): Promise<DashboardMetrics>;
}
