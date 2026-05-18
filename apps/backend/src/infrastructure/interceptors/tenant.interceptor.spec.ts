import { describe, it, expect, beforeEach, jest } from 'jest';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantInterceptor } from '../../../../infrastructure/interceptors/tenant.interceptor';

describe('TenantInterceptor', () => {
  let interceptor: TenantInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantInterceptor],
    }).compile();

    interceptor = module.get<TenantInterceptor>(TenantInterceptor);
  });

  it('should attach tenantId to the request if user exists', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { tenantId: 'tenant-uuid' },
        }),
      }),
      handle: jest
        .fn()
        .mockReturnValue({ observable: { subscribe: jest.fn() } }),
    } as any;

    await interceptor.intercept(context, { handle: () => ({}) } as any);

    expect(context.switchToHttp().getRequest().tenantId).toBe('tenant-uuid');
  });

  it('should not attach tenantId if user does not exist', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: null,
        }),
      }),
      handle: jest
        .fn()
        .mockReturnValue({ observable: { subscribe: jest.fn() } }),
    } as any;

    await interceptor.intercept(context, { handle: () => ({}) } as any);

    expect(context.switchToHttp().getRequest().tenantId).toBeUndefined();
  });
});
