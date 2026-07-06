import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantInterceptor } from './tenant.interceptor';

describe('TenantInterceptor', () => {
  let interceptor: TenantInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantInterceptor],
    }).compile();

    interceptor = module.get<TenantInterceptor>(TenantInterceptor);
  });

  it('should attach tenantId to the request if user exists', async () => {
    const request = { user: { tenantId: 'tenant-uuid' } };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      handle: jest
        .fn()
        .mockReturnValue({ observable: { subscribe: jest.fn() } }),
    } as any;

    await interceptor.intercept(context, { handle: () => ({}) } as any);

    expect(request.tenantId).toBe('tenant-uuid');
  });

  it('should not attach tenantId if user does not exist', async () => {
    const request = { user: null };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      handle: jest
        .fn()
        .mockReturnValue({ observable: { subscribe: jest.fn() } }),
    } as any;

    await interceptor.intercept(context, { handle: () => ({}) } as any);

    expect(request.tenantId).toBeUndefined();
  });
});
