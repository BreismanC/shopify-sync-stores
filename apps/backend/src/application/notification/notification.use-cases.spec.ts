import {
  CreateNotificationUseCase,
  UpdateNotificationUseCase,
} from './notification.use-cases';
import { INotificationRepository } from './repositories/notification.repository';
import { IRealtimePublisher } from '../ports/realtime-publisher.port';

describe('Notification use cases', () => {
  it('creates once per tenant/event and publishes to the tenant', async () => {
    const saved = { id: 'n-1', tenantId: 'tenant-1', userId: null } as any;
    const repository = {
      findByEventId: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(saved),
      create: jest.fn((input) => ({ ...input, id: 'n-1', tenantId: 'tenant-1', userId: null })),
      save: jest.fn().mockResolvedValue(saved),
    };
    const realtime = { publishToTenant: jest.fn(), publishToUser: jest.fn() };
    const useCase = new CreateNotificationUseCase(
      repository as unknown as INotificationRepository,
      realtime as unknown as IRealtimePublisher,
    );

    await useCase.execute({ tenantId: 'tenant-1', type: 'TEST', title: 'Title', message: 'Message', eventId: 'event-1' });
    await useCase.execute({ tenantId: 'tenant-1', type: 'TEST', title: 'Title', message: 'Message', eventId: 'event-1' });

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(realtime.publishToTenant).toHaveBeenCalledWith('tenant-1', 'notification.created', saved);
  });

  it('updates only a notification visible to the requesting user', async () => {
    const notification = { id: 'n-1', readAt: null, archivedAt: null } as any;
    const repository = {
      findByIdForTenant: jest.fn().mockResolvedValue(notification),
      save: jest.fn().mockResolvedValue(notification),
    };
    const useCase = new UpdateNotificationUseCase(repository as unknown as INotificationRepository);

    await useCase.execute('tenant-1', 'user-1', 'n-1', 'read');

    expect(repository.findByIdForTenant).toHaveBeenCalledWith('n-1', 'tenant-1', 'user-1');
    expect(notification.readAt).toBeInstanceOf(Date);
  });
});
