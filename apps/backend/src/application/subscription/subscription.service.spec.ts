import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { ISubscriptionRepository } from './repositories/ISubscriptionRepository';
import { SubscriptionPlan } from '../../domain/enums/subscription-plan.enum';

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;
  let subscriptionRepository: jest.Mocked<ISubscriptionRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: ISubscriptionRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findByTenantId: jest.fn(),
          },
        },
      ],
    }).compile();

    subscriptionService = module.get<SubscriptionService>(SubscriptionService);
    subscriptionRepository = module.get(ISubscriptionRepository);
  });

  it('should create a trial subscription with 14 days end date', async () => {
    const tenantId = 'tenant-uuid';
    const mockSubscription = {
      id: 'sub-uuid',
      tenantId,
      planType: SubscriptionPlan.FREE,
      startDate: new Date(),
      trialEndDate: new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000),
    };

    subscriptionRepository.create.mockReturnValue(mockSubscription as any);
    subscriptionRepository.save.mockResolvedValue(mockSubscription as any);

    const result = await subscriptionService.createTrial(tenantId);

    expect(subscriptionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        planType: SubscriptionPlan.FREE,
      }),
    );
    expect(result.trialEndDate?.getTime()).toBeCloseTo(
      mockSubscription.trialEndDate.getTime(),
      -3,
    );
    expect(result).toEqual(mockSubscription);
  });

  it('should find subscription by tenant id', async () => {
    const tenantId = 'tenant-uuid';
    const mockSubscription = { id: 'sub-uuid', tenantId };
    subscriptionRepository.findByTenantId.mockResolvedValue(
      mockSubscription as any,
    );

    const result = await subscriptionService.findByTenantId(tenantId);

    expect(subscriptionRepository.findByTenantId).toHaveBeenCalledWith(
      tenantId,
    );
    expect(result).toEqual(mockSubscription);
  });
});
