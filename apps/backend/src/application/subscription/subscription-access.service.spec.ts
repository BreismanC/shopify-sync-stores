import { Test, TestingModule } from '@nestjs/testing';
import {
  SubscriptionAccessService,
  FeatureKey,
} from './subscription-access.service';
import { ISubscriptionRepository } from './repositories/ISubscriptionRepository';
import { SubscriptionPlan } from '../../domain/enums/subscription-plan.enum';

describe('SubscriptionAccessService', () => {
  let subscriptionAccessService: SubscriptionAccessService;
  let subscriptionRepository: jest.Mocked<ISubscriptionRepository>;

  beforeEach(async () => {
    subscriptionRepository = {
      findByTenantId: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findByExternalSubscriptionId: jest.fn(),
      findExpired: jest.fn(),
      findPendingPayment: jest.fn(),
      findByNextBillingDate: jest.fn(),
      updateStatus: jest.fn(),
      findOverdue: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionAccessService,
        {
          provide: ISubscriptionRepository,
          useValue: subscriptionRepository,
        },
      ],
    }).compile();

    subscriptionAccessService = module.get<SubscriptionAccessService>(
      SubscriptionAccessService,
    );
  });

  describe('getPlanLimits', () => {
    it('should return TRIAL limits when no subscription exists', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue(null);

      const limits =
        await subscriptionAccessService.getPlanLimits('tenant-uuid');

      expect(limits.maxConnections).toBe(1);
      expect(limits.maxStores).toBe(1);
      expect(limits.maxTeamMembers).toBe(0);
      expect(limits.canSyncInventory).toBe(false);
      expect(limits.canSyncOrders).toBe(false);
      expect(limits.canAccessMarketplace).toBe(false);
      expect(limits.canInviteTeam).toBe(false);
    });

    it('should return TRIAL limits for TRIAL plan', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.TRIAL,
      } as any);

      const limits =
        await subscriptionAccessService.getPlanLimits('tenant-uuid');

      expect(limits.maxConnections).toBe(1);
      expect(limits.maxStores).toBe(1);
      expect(limits.maxTeamMembers).toBe(0);
      expect(limits.canSyncInventory).toBe(false);
      expect(limits.canSyncOrders).toBe(false);
      expect(limits.canAccessMarketplace).toBe(false);
    });

    it('should return BASIC limits for BASIC plan', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.BASIC,
      } as any);

      const limits =
        await subscriptionAccessService.getPlanLimits('tenant-uuid');

      expect(limits.maxConnections).toBe(3);
      expect(limits.maxStores).toBe(2);
      expect(limits.maxTeamMembers).toBe(3);
      expect(limits.canSyncInventory).toBe(true);
      expect(limits.canSyncOrders).toBe(false);
      expect(limits.canAccessMarketplace).toBe(false);
      expect(limits.canInviteTeam).toBe(true);
    });

    it('should return PRO limits for PRO plan', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.PRO,
      } as any);

      const limits =
        await subscriptionAccessService.getPlanLimits('tenant-uuid');

      expect(limits.maxConnections).toBe(10);
      expect(limits.maxStores).toBe(5);
      expect(limits.maxTeamMembers).toBe(10);
      expect(limits.canSyncInventory).toBe(true);
      expect(limits.canSyncOrders).toBe(true);
      expect(limits.canAccessMarketplace).toBe(true);
      expect(limits.canInviteTeam).toBe(true);
    });

    it('should return unlimited limits for ENTERPRISE plan', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.ENTERPRISE,
      } as any);

      const limits =
        await subscriptionAccessService.getPlanLimits('tenant-uuid');

      expect(limits.maxConnections).toBe(-1);
      expect(limits.maxStores).toBe(-1);
      expect(limits.maxTeamMembers).toBe(-1);
      expect(limits.canSyncInventory).toBe(true);
      expect(limits.canSyncOrders).toBe(true);
      expect(limits.canAccessMarketplace).toBe(true);
      expect(limits.canInviteTeam).toBe(true);
    });
  });

  describe('canAccessFeature', () => {
    it('should return true for canSyncInventory on BASIC plan', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.BASIC,
      } as any);

      const result = await subscriptionAccessService.canAccessFeature(
        'tenant-uuid',
        FeatureKey.CAN_SYNC_INVENTORY,
      );

      expect(result).toBe(true);
    });

    it('should return false for canSyncOrders on BASIC plan', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.BASIC,
      } as any);

      const result = await subscriptionAccessService.canAccessFeature(
        'tenant-uuid',
        FeatureKey.CAN_SYNC_ORDERS,
      );

      expect(result).toBe(false);
    });

    it('should return true for canSyncOrders on PRO plan', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.PRO,
      } as any);

      const result = await subscriptionAccessService.canAccessFeature(
        'tenant-uuid',
        FeatureKey.CAN_SYNC_ORDERS,
      );

      expect(result).toBe(true);
    });

    it('should return false for canInviteTeam on TRIAL plan', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.TRIAL,
      } as any);

      const result = await subscriptionAccessService.canAccessFeature(
        'tenant-uuid',
        FeatureKey.CAN_INVITE_TEAM,
      );

      expect(result).toBe(false);
    });
  });

  describe('canAddConnection', () => {
    it('should return true when under the limit', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.BASIC,
      } as any);

      const result = await subscriptionAccessService.canAddConnection(
        'tenant-uuid',
        2,
      );

      expect(result).toBe(true);
    });

    it('should return false when at the limit', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.BASIC,
      } as any);

      const result = await subscriptionAccessService.canAddConnection(
        'tenant-uuid',
        3,
      );

      expect(result).toBe(false);
    });

    it('should return true for ENTERPRISE (unlimited)', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.ENTERPRISE,
      } as any);

      const result = await subscriptionAccessService.canAddConnection(
        'tenant-uuid',
        999,
      );

      expect(result).toBe(true);
    });

    it('should return false when over the limit', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.BASIC,
      } as any);

      const result = await subscriptionAccessService.canAddConnection(
        'tenant-uuid',
        4,
      );

      expect(result).toBe(false);
    });
  });

  describe('canAddStore', () => {
    it('should return true when under the limit', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.PRO,
      } as any);

      const result = await subscriptionAccessService.canAddStore(
        'tenant-uuid',
        4,
      );

      expect(result).toBe(true);
    });

    it('should return false when at the limit', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.PRO,
      } as any);

      const result = await subscriptionAccessService.canAddStore(
        'tenant-uuid',
        5,
      );

      expect(result).toBe(false);
    });

    it('should return true for ENTERPRISE (unlimited)', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.ENTERPRISE,
      } as any);

      const result = await subscriptionAccessService.canAddStore(
        'tenant-uuid',
        100,
      );

      expect(result).toBe(true);
    });
  });

  describe('canAddTeamMember', () => {
    it('should return true when under the limit for BASIC', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.BASIC,
      } as any);

      const result = await subscriptionAccessService.canAddTeamMember(
        'tenant-uuid',
        2,
      );

      expect(result).toBe(true);
    });

    it('should return false when at the limit for BASIC', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.BASIC,
      } as any);

      const result = await subscriptionAccessService.canAddTeamMember(
        'tenant-uuid',
        3,
      );

      expect(result).toBe(false);
    });

    it('should return true for ENTERPRISE (unlimited)', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.ENTERPRISE,
      } as any);

      const result = await subscriptionAccessService.canAddTeamMember(
        'tenant-uuid',
        100,
      );

      expect(result).toBe(true);
    });

    it('should return false for TRIAL (0 members allowed)', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.TRIAL,
      } as any);

      const result = await subscriptionAccessService.canAddTeamMember(
        'tenant-uuid',
        0,
      );

      expect(result).toBe(false);
    });
  });

  describe('getRemainingConnections', () => {
    it('should return correct remaining count', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.PRO,
      } as any);

      const result = await subscriptionAccessService.getRemainingConnections(
        'tenant-uuid',
        3,
      );

      expect(result).toBe(7);
    });

    it('should return 0 when at limit', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.BASIC,
      } as any);

      const result = await subscriptionAccessService.getRemainingConnections(
        'tenant-uuid',
        3,
      );

      expect(result).toBe(0);
    });

    it('should return -1 for ENTERPRISE (unlimited)', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.ENTERPRISE,
      } as any);

      const result = await subscriptionAccessService.getRemainingConnections(
        'tenant-uuid',
        500,
      );

      expect(result).toBe(-1);
    });

    it('should not return negative values', async () => {
      subscriptionRepository.findByTenantId.mockResolvedValue({
        id: 'sub-uuid',
        planType: SubscriptionPlan.BASIC,
      } as any);

      const result = await subscriptionAccessService.getRemainingConnections(
        'tenant-uuid',
        10,
      );

      expect(result).toBe(0);
    });
  });
});
