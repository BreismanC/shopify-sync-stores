import { Notification } from '../../../domain/entities/notification.entity';

export interface NotificationFilters {
  state?: 'all' | 'unread' | 'read' | 'archived';
  page: number;
  perPage: number;
}

export abstract class INotificationRepository {
  abstract create(input: Partial<Notification>): Notification;
  abstract save(notification: Notification): Promise<Notification>;
  abstract findByEventId(
    tenantId: string,
    eventId: string,
  ): Promise<Notification | null>;
  abstract findByIdForTenant(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<Notification | null>;
  abstract list(
    tenantId: string,
    userId: string,
    filters: NotificationFilters,
  ): Promise<{ data: Notification[]; total: number; unread: number }>;
  abstract markAll(
    tenantId: string,
    userId: string,
    action: 'read' | 'archive',
  ): Promise<number>;
}
