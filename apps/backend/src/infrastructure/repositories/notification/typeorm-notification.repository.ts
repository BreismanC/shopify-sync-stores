import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { Notification } from '../../../domain/entities/notification.entity';
import {
  INotificationRepository,
  NotificationFilters,
} from '../../../application/notification/repositories/notification.repository';

@Injectable()
export class TypeOrmNotificationRepository implements INotificationRepository {
  constructor(
    @InjectRepository(Notification)
    private readonly repository: Repository<Notification>,
  ) {}

  create(input: Partial<Notification>) {
    return this.repository.create(input);
  }
  save(notification: Notification) {
    return this.repository.save(notification);
  }
  findByEventId(tenantId: string, eventId: string) {
    return this.repository.findOne({ where: { tenantId, eventId } });
  }
  findByIdForTenant(id: string, tenantId: string) {
    return this.repository.findOne({ where: { id, tenantId } });
  }

  async list(tenantId: string, userId: string, filters: NotificationFilters) {
    const base = this.repository
      .createQueryBuilder('n')
      .where('n.tenantId = :tenantId', { tenantId })
      .andWhere(
        new Brackets((qb) =>
          qb
            .where('n.userId IS NULL')
            .orWhere('n.userId = :userId', { userId }),
        ),
      );
    if (filters.state === 'unread')
      base.andWhere('n.readAt IS NULL').andWhere('n.archivedAt IS NULL');
    if (filters.state === 'read')
      base.andWhere('n.readAt IS NOT NULL').andWhere('n.archivedAt IS NULL');
    if (filters.state === 'archived') base.andWhere('n.archivedAt IS NOT NULL');
    if (!filters.state || filters.state === 'all')
      base.andWhere('n.archivedAt IS NULL');
    const [data, total] = await base
      .orderBy('n.createdAt', 'DESC')
      .skip((filters.page - 1) * filters.perPage)
      .take(filters.perPage)
      .getManyAndCount();
    const unread = await this.repository.count({
      where: { tenantId, readAt: IsNull(), archivedAt: IsNull() },
    });
    return { data, total, unread };
  }

  async markAll(tenantId: string, userId: string, action: 'read' | 'archive') {
    const now = new Date();
    const result = await this.repository
      .createQueryBuilder()
      .update(Notification)
      .set(action === 'read' ? { readAt: now } : { archivedAt: now })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('(userId IS NULL OR userId = :userId)', { userId })
      .execute();
    return result.affected ?? 0;
  }
}
