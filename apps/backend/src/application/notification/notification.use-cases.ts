import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IRealtimePublisher } from '../ports/realtime-publisher.port';
import {
  INotificationRepository,
  NotificationFilters,
} from './repositories/notification.repository';

export interface CreateNotificationInput {
  tenantId: string;
  userId?: string | null;
  type: string;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  eventId?: string;
}

@Injectable()
export class CreateNotificationUseCase {
  constructor(
    @Inject(INotificationRepository)
    private readonly repository: INotificationRepository,
    @Inject(IRealtimePublisher) private readonly realtime: IRealtimePublisher,
  ) {}

  async execute(input: CreateNotificationInput) {
    if (input.eventId) {
      const existing = await this.repository.findByEventId(
        input.tenantId,
        input.eventId,
      );
      if (existing) return existing;
    }
    const notification = await this.repository.save(
      this.repository.create({
        ...input,
        userId: input.userId ?? null,
        payload: input.payload ?? {},
        eventId: input.eventId ?? null,
        readAt: null,
        archivedAt: null,
      }),
    );
    const event = { ...notification } as unknown as Record<string, unknown>;
    if (notification.userId)
      await this.realtime.publishToUser(
        notification.userId,
        'notification.created',
        event,
      );
    else
      await this.realtime.publishToTenant(
        notification.tenantId,
        'notification.created',
        event,
      );
    return notification;
  }
}

@Injectable()
export class GetNotificationsUseCase {
  constructor(
    @Inject(INotificationRepository)
    private readonly repository: INotificationRepository,
  ) {}
  execute(tenantId: string, userId: string, filters: NotificationFilters) {
    return this.repository.list(tenantId, userId, filters);
  }
}

@Injectable()
export class UpdateNotificationUseCase {
  constructor(
    @Inject(INotificationRepository)
    private readonly repository: INotificationRepository,
  ) {}
  async execute(
    tenantId: string,
    userId: string,
    id: string,
    action: 'read' | 'unread' | 'archive' | 'unarchive',
  ) {
    const notification = await this.repository.findByIdForTenant(id, tenantId, userId);
    if (!notification)
      throw new NotFoundException('Notificación no encontrada.');
    if (action === 'read') notification.readAt = new Date();
    if (action === 'unread') notification.readAt = null;
    if (action === 'archive') notification.archivedAt = new Date();
    if (action === 'unarchive') notification.archivedAt = null;
    return this.repository.save(notification);
  }
  all(tenantId: string, userId: string, action: 'read' | 'archive') {
    return this.repository.markAll(tenantId, userId, action);
  }
}
