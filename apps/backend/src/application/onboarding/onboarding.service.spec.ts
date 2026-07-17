import { OnboardingService } from './onboarding.service';
import { OnboardingStatus } from '../../domain/enums/onboarding-status.enum';

describe('OnboardingService', () => {
  describe('upsertTenant', () => {
    it('should advance tenant onboardingStatus when owner completes step 1', async () => {
      const user = {
        id: 'user-uuid',
        tenantId: null as string | null,
      };
      const tenant = {
        id: 'tenant-uuid',
        name: 'Acme Inc',
        onboardingStatus: OnboardingStatus.PENDING_TENANT_CONFIG,
      };

      const userRepository = {
        findById: jest.fn().mockResolvedValue(user),
        save: jest.fn().mockImplementation(async (entity) => entity),
      };
      const tenantRepository = {
        findById: jest.fn().mockResolvedValue(tenant),
        save: jest.fn().mockImplementation(async (entity) => entity),
      };
      const tenantService = {
        upsertTenant: jest.fn().mockResolvedValue(tenant),
      };

      const service = new OnboardingService(
        userRepository as any,
        tenantRepository as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        tenantService as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const result = await service.upsertTenant(user.id, { name: tenant.name });

      expect(tenantService.upsertTenant).toHaveBeenCalledWith(
        user.id,
        tenant.name,
      );
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenant.id,
        }),
      );
      expect(tenantRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          onboardingStatus: OnboardingStatus.PENDING_PLAN_SELECTION,
        }),
      );
      expect(result).toEqual({
        tenant,
        onboardingStatus: OnboardingStatus.PENDING_PLAN_SELECTION,
      });
    });
  });
});
