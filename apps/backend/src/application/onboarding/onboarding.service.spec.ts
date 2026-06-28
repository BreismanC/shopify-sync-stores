import { OnboardingService } from './onboarding.service';
import { OnboardingStatus } from '../../domain/enums/onboarding-status.enum';

describe('OnboardingService', () => {
  describe('upsertTenant', () => {
    it('should keep the tenant linked when a user without tenant completes step 1', async () => {
      const user = {
        id: 'user-uuid',
        tenantId: null,
        onboardingStatus: OnboardingStatus.PENDING_TENANT_CONFIG,
      };
      const tenant = {
        id: 'tenant-uuid',
        name: 'Acme Inc',
      };

      const userRepository = {
        findById: jest.fn().mockResolvedValue(user),
        save: jest.fn().mockImplementation(async (entity) => entity),
      };
      const tenantService = {
        upsertTenant: jest.fn().mockResolvedValue(tenant),
      };

      const service = new OnboardingService(
        userRepository as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        tenantService as any,
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
