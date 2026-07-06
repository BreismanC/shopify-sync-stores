import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionCron } from './subscription.cron';
import { ISubscriptionRepository } from '../../application/subscription/repositories/ISubscriptionRepository';
import { SubscriptionStatus } from '../../domain/enums/subscription-status.enum';

describe('SubscriptionCron', () => {
  let subscriptionCron: SubscriptionCron;
  let subscriptionRepository: jest.Mocked<ISubscriptionRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionCron,
        {
          provide: ISubscriptionRepository,
          useValue: {
            findExpired: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    subscriptionCron = module.get<SubscriptionCron>(SubscriptionCron);
    subscriptionRepository = module.get(ISubscriptionRepository);
  });

  it('should mark expired subscriptions as EXPIRED', async () => {
    const now = new Date();
    const expiredSub = {
      id: 'sub-uuid',
      trialEndDate: new Date(now.getTime() - 1000),
    };

    subscriptionRepository.findExpired.mockResolvedValue([expiredSub] as any);
    subscriptionRepository.updateStatus.mockResolvedValue(undefined);

    await subscriptionCron.handleSubscriptionExpirations();

    expect(subscriptionRepository.findExpired).toHaveBeenCalledWith(
      expect.any(Date),
    );
    expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
      'sub-uuid',
      SubscriptionStatus.EXPIRED,
    );
  });

  it('should do nothing if no expired subscriptions are found', async () => {
    subscriptionRepository.findExpired.mockResolvedValue([]);

    await subscriptionCron.handleSubscriptionExpirations();

    expect(subscriptionRepository.updateStatus).not.toHaveBeenCalled();
  });
});
