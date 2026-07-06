import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingGuard } from '../guards/onboarding.guard';
import { OnboardingStatus } from '../../../domain/enums/onboarding-status.enum';
import { ForbiddenException } from '@nestjs/common';

describe('OnboardingGuard', () => {
  let guard: OnboardingGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OnboardingGuard],
    }).compile();

    guard = module.get<OnboardingGuard>(OnboardingGuard);
  });

  it('should allow access if onboardingStatus is COMPLETED', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { onboardingStatus: OnboardingStatus.COMPLETED },
        }),
      }),
    } as any;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access to /api/onboarding routes even if not completed', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { onboardingStatus: OnboardingStatus.PENDING_STORE_CONFIG },
          url: '/api/onboarding/step-1',
        }),
      }),
    } as any;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access to /api/auth routes even if not completed', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { onboardingStatus: OnboardingStatus.PENDING_TENANT_CONFIG },
          url: '/api/auth/login',
        }),
      }),
    } as any;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException for other routes if not completed', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { onboardingStatus: OnboardingStatus.PENDING_STORE_CONFIG },
          url: '/api/products',
        }),
      }),
    } as any;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should deny access if no user is present', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: null,
        }),
      }),
    } as any;

    expect(guard.canActivate(context)).toBe(false);
  });
});
