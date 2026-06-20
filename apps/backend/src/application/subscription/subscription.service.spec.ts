import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { ISubscriptionRepository } from './repositories/ISubscriptionRepository';
import {
  SubscriptionPlan,
  PLAN_PRICING,
} from '../../domain/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../domain/enums/subscription-status.enum';
import { BillingPeriod } from '../../domain/enums/billing-period.enum';

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;
  let subscriptionRepository: jest.Mocked<ISubscriptionRepository>;

  const mockTenantId = 'tenant-uuid';

  beforeEach(async () => {
    subscriptionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findByTenantId: jest.fn(),
      findByExternalSubscriptionId: jest.fn(),
      findExpired: jest.fn(),
      findPendingPayment: jest.fn(),
      findByNextBillingDate: jest.fn(),
      updateStatus: jest.fn(),
      findOverdue: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: ISubscriptionRepository,
          useValue: subscriptionRepository,
        },
      ],
    }).compile();

    subscriptionService = module.get<SubscriptionService>(SubscriptionService);
  });

  describe('createTrial', () => {
    it('should create a trial subscription with 7 days end date', async () => {
      const mockSubscription = {
        id: 'sub-uuid',
        tenantId: mockTenantId,
        planType: SubscriptionPlan.TRIAL,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(),
        trialEndDate: null as Date,
      };

      subscriptionRepository.create.mockImplementation((data) => data as any);
      subscriptionRepository.save.mockImplementation(
        (sub) => Promise.resolve(sub) as any,
      );

      const result = await subscriptionService.createTrial(mockTenantId);

      expect(subscriptionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          planType: SubscriptionPlan.TRIAL,
          status: SubscriptionStatus.ACTIVE,
        }),
      );
      expect(result.trialEndDate).toBeInstanceOf(Date);
      expect(result.trialEndDate.getTime()).toBeCloseTo(
        new Date().getTime() + 7 * 24 * 60 * 60 * 1000,
        -3,
      );
    });

    it('should set startDate to current date', async () => {
      const before = new Date();
      const mockSubscription = {
        id: 'sub-uuid',
        tenantId: mockTenantId,
        planType: SubscriptionPlan.TRIAL,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(),
        trialEndDate: null as Date,
      };

      subscriptionRepository.create.mockImplementation((data) => data as any);
      subscriptionRepository.save.mockImplementation(
        (sub) => Promise.resolve(sub) as any,
      );

      await subscriptionService.createTrial(mockTenantId);

      const createCall = subscriptionRepository.create.mock.calls[0][0];
      expect(createCall.startDate).toBeInstanceOf(Date);
      const after = new Date();
      expect(createCall.startDate.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(createCall.startDate.getTime()).toBeLessThanOrEqual(
        after.getTime(),
      );
    });
  });

  describe('findByTenantId', () => {
    it('should return subscription when found', async () => {
      const mockSubscription = {
        id: 'sub-uuid',
        tenantId: mockTenantId,
        planType: SubscriptionPlan.BASIC,
      };
      subscriptionRepository.findByTenantId.mockResolvedValue(
        mockSubscription as any,
      );

      const result = await subscriptionService.findByTenantId(mockTenantId);

      expect(subscriptionRepository.findByTenantId).toHaveBeenCalledWith(
        mockTenantId,
      );
      expect(result).toEqual(mockSubscription);
    });

    it('should return null when no subscription found', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue(null);

      const result = await subscriptionService.findByTenantId(
        'non-existent-tenant',
      );

      expect(result).toBeNull();
    });
  });

  describe('upgradePlan', () => {
    it('should update plan and set status to PENDING_PAYMENT', async () => {
      const existingSubscription = {
        id: 'sub-uuid',
        tenantId: mockTenantId,
        planType: SubscriptionPlan.TRIAL,
        status: SubscriptionStatus.ACTIVE,
        billingPeriod: BillingPeriod.MONTHLY,
      };
      const updatedSubscription = {
        ...existingSubscription,
        planType: SubscriptionPlan.PRO,
        billingPeriod: BillingPeriod.YEARLY,
        status: SubscriptionStatus.PENDING_PAYMENT,
      };

      subscriptionRepository.findByTenantId.mockResolvedValue(
        existingSubscription as any,
      );
      subscriptionRepository.save.mockResolvedValue(updatedSubscription as any);

      const result = await subscriptionService.upgradePlan(
        mockTenantId,
        SubscriptionPlan.PRO,
        BillingPeriod.YEARLY,
      );

      expect(subscriptionRepository.findByTenantId).toHaveBeenCalledWith(
        mockTenantId,
      );
      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          planType: SubscriptionPlan.PRO,
          billingPeriod: BillingPeriod.YEARLY,
          status: SubscriptionStatus.PENDING_PAYMENT,
        }),
      );
      expect(result.planType).toBe(SubscriptionPlan.PRO);
      expect(result.status).toBe(SubscriptionStatus.PENDING_PAYMENT);
    });

    it('should throw error when subscription not found', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue(null);

      await expect(
        subscriptionService.upgradePlan(
          mockTenantId,
          SubscriptionPlan.PRO,
          BillingPeriod.MONTHLY,
        ),
      ).rejects.toThrow('Suscripción no encontrada');
    });

    it('should change billing period when upgrading', async () => {
      const existingSubscription = {
        id: 'sub-uuid',
        tenantId: mockTenantId,
        planType: SubscriptionPlan.BASIC,
        billingPeriod: BillingPeriod.MONTHLY,
      };
      subscriptionRepository.findByTenantId.mockResolvedValue(
        existingSubscription as any,
      );
      subscriptionRepository.save.mockImplementation((sub) =>
        Promise.resolve(sub as any),
      );

      await subscriptionService.upgradePlan(
        mockTenantId,
        SubscriptionPlan.PRO,
        BillingPeriod.YEARLY,
      );

      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          billingPeriod: BillingPeriod.YEARLY,
        }),
      );
    });
  });

  describe('cancelSubscription', () => {
    it('should set autoRecurrent to false and status to CANCELED', async () => {
      const existingSubscription = {
        id: 'sub-uuid',
        tenantId: mockTenantId,
        status: SubscriptionStatus.ACTIVE,
        autoRecurrent: true,
      };
      const canceledSubscription = {
        ...existingSubscription,
        status: SubscriptionStatus.CANCELED,
        autoRecurrent: false,
      };

      subscriptionRepository.findByTenantId.mockResolvedValue(
        existingSubscription as any,
      );
      subscriptionRepository.save.mockResolvedValue(
        canceledSubscription as any,
      );

      const result = await subscriptionService.cancelSubscription(
        mockTenantId,
        'USER_REQUEST',
      );

      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          autoRecurrent: false,
          status: SubscriptionStatus.CANCELED,
        }),
      );
      expect(result.status).toBe(SubscriptionStatus.CANCELED);
      expect(result.autoRecurrent).toBe(false);
    });

    it('should throw error when subscription not found', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue(null);

      await expect(
        subscriptionService.cancelSubscription(mockTenantId, 'USER_REQUEST'),
      ).rejects.toThrow('Suscripción no encontrada');
    });
  });

  describe('reactivateSubscription', () => {
    it('should set status to ACTIVE', async () => {
      const suspendedSubscription = {
        id: 'sub-uuid',
        tenantId: mockTenantId,
        status: SubscriptionStatus.SUSPENDED,
      };
      const reactivatedSubscription = {
        ...suspendedSubscription,
        status: SubscriptionStatus.ACTIVE,
      };

      subscriptionRepository.findByTenantId.mockResolvedValue(
        suspendedSubscription as any,
      );
      subscriptionRepository.save.mockResolvedValue(
        reactivatedSubscription as any,
      );

      const result =
        await subscriptionService.reactivateSubscription(mockTenantId);

      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
        }),
      );
      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('should throw error when subscription not found', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue(null);

      await expect(
        subscriptionService.reactivateSubscription(mockTenantId),
      ).rejects.toThrow('Suscripción no encontrada');
    });
  });

  describe('getSubscriptionWithAccess', () => {
    it('should return subscription with TRIAL limits', async () => {
      const subscription = {
        id: 'sub-uuid',
        tenantId: mockTenantId,
        planType: SubscriptionPlan.TRIAL,
        status: SubscriptionStatus.ACTIVE,
      };

      subscriptionRepository.findByTenantId.mockResolvedValue(
        subscription as any,
      );

      const result =
        await subscriptionService.getSubscriptionWithAccess(mockTenantId);

      expect(result.subscription).toEqual(subscription);
      expect(result.maxConnections).toBe(1);
      expect(result.maxStores).toBe(1);
      expect(result.maxTeamMembers).toBe(0);
    });

    it('should return subscription with BASIC limits', async () => {
      const subscription = {
        id: 'sub-uuid',
        tenantId: mockTenantId,
        planType: SubscriptionPlan.BASIC,
        status: SubscriptionStatus.ACTIVE,
      };

      subscriptionRepository.findByTenantId.mockResolvedValue(
        subscription as any,
      );

      const result =
        await subscriptionService.getSubscriptionWithAccess(mockTenantId);

      expect(result.maxConnections).toBe(3);
      expect(result.maxStores).toBe(2);
      expect(result.maxTeamMembers).toBe(3);
    });

    it('should return subscription with PRO limits', async () => {
      const subscription = {
        id: 'sub-uuid',
        tenantId: mockTenantId,
        planType: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
      };

      subscriptionRepository.findByTenantId.mockResolvedValue(
        subscription as any,
      );

      const result =
        await subscriptionService.getSubscriptionWithAccess(mockTenantId);

      expect(result.maxConnections).toBe(10);
      expect(result.maxStores).toBe(5);
      expect(result.maxTeamMembers).toBe(10);
    });

    it('should return subscription with ENTERPRISE unlimited limits', async () => {
      const subscription = {
        id: 'sub-uuid',
        tenantId: mockTenantId,
        planType: SubscriptionPlan.ENTERPRISE,
        status: SubscriptionStatus.ACTIVE,
      };

      subscriptionRepository.findByTenantId.mockResolvedValue(
        subscription as any,
      );

      const result =
        await subscriptionService.getSubscriptionWithAccess(mockTenantId);

      expect(result.maxConnections).toBe(-1);
      expect(result.maxStores).toBe(-1);
      expect(result.maxTeamMembers).toBe(-1);
    });

    it('should throw error when subscription not found', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue(null);

      await expect(
        subscriptionService.getSubscriptionWithAccess(mockTenantId),
      ).rejects.toThrow('Suscripción no encontrada');
    });
  });

  describe('getPlanLimits (private via getSubscriptionWithAccess)', () => {
    it('should return zero limits for unknown plan type', async () => {
      const subscription = {
        id: 'sub-uuid',
        tenantId: mockTenantId,
        planType: 'UNKNOWN' as SubscriptionPlan,
        status: SubscriptionStatus.ACTIVE,
      };

      subscriptionRepository.findByTenantId.mockResolvedValue(
        subscription as any,
      );

      const result =
        await subscriptionService.getSubscriptionWithAccess(mockTenantId);

      expect(result.maxConnections).toBe(0);
      expect(result.maxStores).toBe(0);
      expect(result.maxTeamMembers).toBe(0);
    });
  });
});
